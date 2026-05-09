import { useCallback, useEffect, useRef, useState } from "react";
// @google/genai Live API. Type imports may need adjustment if SDK API surface evolves.
// Reference: https://ai.google.dev/api/live (Gemini Live)
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from "@google/genai";
import { supabase } from "@/integrations/supabase/client";

export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "listening"
  | "speaking"
  | "ended"
  | "error";

export type VoiceTurn = {
  role: "interviewer" | "candidate";
  content: string;
  timestamp: string;
};

export type VoiceInterviewOptions = {
  systemInstruction: string;
  /** Voice persona name — e.g. "Aoede" (warm female), "Charon" (firm male) */
  voiceName?: string;
};

export type VoiceInterview = {
  state: VoiceState;
  transcript: VoiceTurn[];
  audioLevel: number;
  isMuted: boolean;
  error: string | null;
  start: () => Promise<void>;
  end: () => Promise<{ audioBlob: Blob | null; transcript: VoiceTurn[] }>;
  toggleMute: () => void;
};

const INPUT_SAMPLE_RATE = 16000; // Gemini Live wants 16kHz PCM16 in
const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live emits 24kHz PCM16 out

function int16ToFloat32(int16: Int16Array): Float32Array {
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    f32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return f32;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/**
 * useVoiceInterview — drives a Gemini Live voice session in the browser.
 *
 * Flow:
 * 1. Mints an ephemeral token from /api/gemini-token
 * 2. Connects via @google/genai Live API
 * 3. Captures mic via AudioWorklet (16kHz PCM16) and streams up
 * 4. Plays back received PCM16 (24kHz) chunks via Web Audio
 * 5. Accumulates transcript from interim text outputs (input transcription + model response)
 * 6. On end(), returns a wav-ish blob of the SESSION (we record both directions to MediaRecorder)
 *
 * Falls back gracefully — caller should check `voice_available` from token endpoint.
 */
export function useVoiceInterview(opts: VoiceInterviewOptions): VoiceInterview {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const playheadRef = useRef<number>(0);
  const isMutedRef = useRef(false);
  const interimUserTextRef = useRef<string>("");
  const interimAssistantTextRef = useRef<string>("");
  const levelLoopRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    try {
      sessionRef.current?.close();
    } catch (e) {
      // ignore
    }
    sessionRef.current = null;
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
      } catch (e) {
        // ignore
      }
    }
    workletNodeRef.current = null;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // ignore
      }
    }
    sourceNodeRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => undefined);
    }
    audioCtxRef.current = null;
    if (outputCtxRef.current && outputCtxRef.current.state !== "closed") {
      outputCtxRef.current.close().catch(() => undefined);
    }
    outputCtxRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    recorderRef.current = null;
    if (levelLoopRef.current != null) {
      cancelAnimationFrame(levelLoopRef.current);
      levelLoopRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // Refs to break the temporal/circular reference between start, handleServerMessage, and playPCM16Chunk.
  // start is declared before the others but needs to call them; using refs lets it always invoke the latest.
  const handleServerMessageRef = useRef<(m: LiveServerMessage) => void>(() => {});
  const playPCM16ChunkRef = useRef<(b64: string) => void>(() => {});

  const start = useCallback(async () => {
    setError(null);
    setState("requesting_permission");

    // 1. Mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e) {
      console.error("mic permission failed", e);
      setError("Microphone permission denied or unavailable.");
      setState("error");
      return;
    }
    streamRef.current = stream;

    // 2. Mint ephemeral token
    setState("connecting");
    let tokenName: string;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) {
        setError("Not authenticated.");
        setState("error");
        cleanup();
        return;
      }
      const res = await fetch("/api/gemini-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!data.voice_available || !data.token || data.token === "STUB") {
        setError(
          data.error ?? "Voice mode not configured (GEMINI_API_KEY missing). Falling back to text mode is recommended.",
        );
        setState("error");
        cleanup();
        return;
      }
      tokenName = data.token as string;
    } catch (e) {
      console.error("token fetch failed", e);
      setError("Could not get voice token.");
      setState("error");
      cleanup();
      return;
    }

    // 3. Connect via @google/genai Live API using the ephemeral token
    let session: Session;
    try {
      const ai = new GoogleGenAI({
        apiKey: tokenName,
        httpOptions: { apiVersion: "v1alpha" },
      });
      session = await ai.live.connect({
        model: "gemini-2.5-flash-preview-native-audio-dialog",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: opts.systemInstruction,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: opts.voiceName ?? "Aoede" },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            // ready to send audio
          },
          onmessage: (m: LiveServerMessage) => handleServerMessageRef.current(m),
          onerror: (err: ErrorEvent) => {
            console.error("Live API error", err);
            setError(err.message ?? "Live API error");
            setState("error");
          },
          onclose: () => {
            // gracefully ended
          },
        },
      });
    } catch (e) {
      console.error("live connect failed", e);
      setError((e as Error).message ?? "Could not connect to Gemini Live.");
      setState("error");
      cleanup();
      return;
    }
    sessionRef.current = session;

    // 4. Set up input audio worklet @ 16kHz
    const audioCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    audioCtxRef.current = audioCtx;
    try {
      await audioCtx.audioWorklet.addModule("/audio-processor-worklet.js");
    } catch (e) {
      console.error("audioWorklet load failed", e);
      setError("Browser does not support AudioWorklet. Use a modern Chrome/Edge/Firefox.");
      setState("error");
      cleanup();
      return;
    }
    const source = audioCtx.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    const worklet = new AudioWorkletNode(audioCtx, "pcm16-processor");
    workletNodeRef.current = worklet;
    worklet.port.onmessage = (ev: MessageEvent<Int16Array>) => {
      if (isMutedRef.current) return;
      const pcm = ev.data;
      const b64 = arrayBufferToBase64(pcm.buffer);
      try {
        sessionRef.current?.sendRealtimeInput({
          audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
        });
      } catch (e) {
        // session probably ended; swallow
      }
    };
    source.connect(worklet);
    // worklet does not need to connect to destination — we're just capturing

    // 5. Output context @ 24kHz for playback
    outputCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    playheadRef.current = outputCtxRef.current.currentTime;

    // 6. Audio level meter for the visualizer
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const dataArr = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(dataArr);
      let max = 0;
      for (let i = 0; i < dataArr.length; i++) {
        const v = Math.abs(dataArr[i] - 128) / 128;
        if (v > max) max = v;
      }
      setAudioLevel(max);
      levelLoopRef.current = requestAnimationFrame(tick);
    };
    tick();

    // 7. Start MediaRecorder to capture session audio (mic + speakers via destination tap)
    // We can only easily record the mic via MediaRecorder. Capturing AI audio requires extra plumbing
    // (AudioWorkletDestination). For v1 we record the mic side only — sufficient for a session log.
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start(1000); // chunked
    } catch (e) {
      console.warn("MediaRecorder not available", e);
    }

    setState("listening");
  }, [opts.systemInstruction, opts.voiceName, cleanup]);

  const handleServerMessage = useCallback((m: LiveServerMessage) => {
    // Input transcription (what the candidate said)
    const inputText = m.serverContent?.inputTranscription?.text;
    if (inputText) {
      interimUserTextRef.current += inputText;
    }
    if (m.serverContent?.inputTranscription?.finished) {
      const text = interimUserTextRef.current.trim();
      interimUserTextRef.current = "";
      if (text) {
        setTranscript((t) => [
          ...t,
          { role: "candidate", content: text, timestamp: new Date().toISOString() },
        ]);
      }
    }

    // Output transcription (what the AI is saying)
    const outputText = m.serverContent?.outputTranscription?.text;
    if (outputText) {
      interimAssistantTextRef.current += outputText;
    }
    if (m.serverContent?.outputTranscription?.finished) {
      const text = interimAssistantTextRef.current.trim();
      interimAssistantTextRef.current = "";
      if (text) {
        setTranscript((t) => [
          ...t,
          { role: "interviewer", content: text, timestamp: new Date().toISOString() },
        ]);
      }
    }

    // Model audio output
    const parts = m.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      const mime = part.inlineData?.mimeType;
      if (data && mime?.startsWith("audio/")) {
        playPCM16ChunkRef.current(data);
      }
    }

    if (m.serverContent?.interrupted) {
      // User interrupted — stop any queued playback by recreating the output ctx
      const out = outputCtxRef.current;
      if (out) {
        out.close().catch(() => undefined);
        outputCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
        playheadRef.current = outputCtxRef.current.currentTime;
      }
    }

    if (m.serverContent?.turnComplete) {
      setState("listening");
    }
  }, []);

  const playPCM16Chunk = useCallback((b64: string) => {
    const out = outputCtxRef.current;
    if (!out) return;
    const int16 = base64ToInt16(b64);
    const float32 = int16ToFloat32(int16);
    const buffer = out.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    const src = out.createBufferSource();
    src.buffer = buffer;
    src.connect(out.destination);
    const now = out.currentTime;
    const startAt = Math.max(now, playheadRef.current);
    src.start(startAt);
    playheadRef.current = startAt + buffer.duration;
    setState("speaking");
  }, []);

  // Keep refs in sync with latest callback identities so `start`'s closures call the current versions.
  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
    playPCM16ChunkRef.current = playPCM16Chunk;
  }, [handleServerMessage, playPCM16Chunk]);

  const end = useCallback(async (): Promise<{ audioBlob: Blob | null; transcript: VoiceTurn[] }> => {
    setState("ended");
    let audioBlob: Blob | null = null;
    if (recorderRef.current) {
      try {
        await new Promise<void>((resolve) => {
          recorderRef.current!.onstop = () => resolve();
          recorderRef.current!.stop();
        });
        audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      } catch (e) {
        console.warn("recorder stop failed", e);
      }
    }
    cleanup();
    return { audioBlob, transcript };
  }, [transcript, cleanup]);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
  }, []);

  return {
    state,
    transcript,
    audioLevel,
    isMuted,
    error,
    start,
    end,
    toggleMute,
  };
}
