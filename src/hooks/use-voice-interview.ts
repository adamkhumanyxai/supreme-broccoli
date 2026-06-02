import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "listening"
  | "processing"
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
  /** Ignored — server picks the ElevenLabs voice via ELEVENLABS_VOICE_ID */
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

// VAD settings
const VAD_THRESHOLD = 0.015; // normalised energy threshold (0–1)
const SILENCE_DURATION_MS = 1500; // ms of silence after speech to trigger send
const MIN_SPEECH_DURATION_MS = 400; // ignore very short sounds / blips

/**
 * useVoiceInterview — Whisper STT + OpenRouter LLM + ElevenLabs TTS pipeline.
 *
 * Flow:
 * 1. Request mic permission
 * 2. Generate AI opening message (start=true, no audio)
 * 3. Loop: record mic → VAD detects end of speech → POST to /api/interview-turn
 *    → receive { user_text, ai_text, audio_b64 } → play audio → back to 3
 *
 * Required server env vars: OPENAI_API_KEY, OPENROUTER_API_KEY, ELEVENLABS_API_KEY.
 * Optional: ELEVENLABS_VOICE_ID (default: pqHfZKP75CvOlQylNhV4 = Bill, Australian male).
 */
export function useVoiceInterview(opts: VoiceInterviewOptions): VoiceInterview {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All mutable state in refs to avoid stale closures in rAF/MediaRecorder callbacks
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentRecorderRef = useRef<MediaRecorder | null>(null);
  const sessionRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const levelLoopRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isEndingRef = useRef(false);
  const isMutedRef = useRef(false);
  const transcriptRef = useRef<VoiceTurn[]>([]);
  const systemInstructionRef = useRef(opts.systemInstruction);
  const hasSpeechRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const lastSpeechRef = useRef<number | null>(null);

  useEffect(() => {
    systemInstructionRef.current = opts.systemInstruction;
  }, [opts.systemInstruction]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const addTurn = useCallback((turn: VoiceTurn) => {
    setTranscript((t) => [...t, turn]);
    transcriptRef.current = [...transcriptRef.current, turn];
  }, []);

  const cleanup = useCallback(() => {
    isEndingRef.current = true;
    if (levelLoopRef.current != null) {
      cancelAnimationFrame(levelLoopRef.current);
      levelLoopRef.current = null;
    }
    if (currentRecorderRef.current?.state !== "inactive") {
      try {
        currentRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
    currentRecorderRef.current = null;
    if (sessionRecorderRef.current?.state !== "inactive") {
      try {
        sessionRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
    sessionRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close().catch(() => undefined);
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
      try {
        document.body.removeChild(audioElementRef.current);
      } catch {
        /* ignore */
      }
      audioElementRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // Decode base64 mp3 and play through a hidden <audio> element.
  const playAudio = useCallback((b64: string): Promise<void> => {
    return new Promise((resolve) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (!audioElementRef.current) {
        const el = document.createElement("audio");
        el.style.display = "none";
        document.body.appendChild(el);
        audioElementRef.current = el;
      }
      const el = audioElementRef.current;
      el.src = url;
      el.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      el.play().catch(() => resolve());
    });
  }, []);

  // Forward refs so sendTurn and startCycle can call each other without circular deps
  const sendTurnRef = useRef<(blob: Blob, isStart?: boolean) => Promise<void>>(async () => {});
  const startCycleRef = useRef<() => void>(() => {});

  useEffect(() => {
    sendTurnRef.current = async (blob: Blob, isStart = false) => {
      if (isEndingRef.current) return;
      setState("processing");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        if (!jwt) {
          setError("Not authenticated.");
          setState("error");
          return;
        }

        const fd = new FormData();
        if (!isStart && blob.size > 0) fd.append("audio", blob, "audio.webm");
        fd.append(
          "messages",
          JSON.stringify(
            transcriptRef.current.map((t) => ({
              role: t.role === "candidate" ? "user" : "assistant",
              content: t.content,
            })),
          ),
        );
        fd.append("system_instruction", systemInstructionRef.current);
        if (isStart) fd.append("start", "true");

        const res = await fetch("/api/interview-turn", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
          body: fd,
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as {
            error?: string;
          };
          setError(errData.error ?? "Voice turn failed.");
          setState("error");
          return;
        }

        const data = (await res.json()) as {
          user_text?: string;
          ai_text?: string;
          audio_b64?: string | null;
          error?: string;
        };

        if (data.error && !data.ai_text) {
          setError(data.error);
          setState("error");
          return;
        }

        // Empty transcription (silence / too short) — just restart listening
        if (!isStart && !data.user_text && !data.ai_text) {
          if (!isEndingRef.current) startCycleRef.current();
          return;
        }

        if (data.user_text) {
          addTurn({
            role: "candidate",
            content: data.user_text,
            timestamp: new Date().toISOString(),
          });
        }
        if (data.ai_text) {
          addTurn({
            role: "interviewer",
            content: data.ai_text,
            timestamp: new Date().toISOString(),
          });
        }

        if (data.audio_b64) {
          setState("speaking");
          await playAudio(data.audio_b64);
        }
      } catch (e) {
        setError((e as Error).message ?? "Turn failed.");
        setState("error");
        return;
      }
      if (!isEndingRef.current) startCycleRef.current();
    };
  }, [playAudio, addTurn]);

  useEffect(() => {
    startCycleRef.current = () => {
      if (!streamRef.current || isEndingRef.current) return;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (isEndingRef.current) return;
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > 2000 && hasSpeechRef.current) {
          void sendTurnRef.current(blob);
        } else {
          setState("listening");
          startCycleRef.current();
        }
      };

      currentRecorderRef.current = recorder;
      hasSpeechRef.current = false;
      speechStartRef.current = null;
      lastSpeechRef.current = null;
      recorder.start(100);
      setState("listening");

      const vadTick = () => {
        if (!analyserRef.current || recorder.state !== "recording" || isEndingRef.current) return;

        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(buf);
        let max = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > max) max = v;
        }
        setAudioLevel(max);

        // When muted, tracks are disabled → max ≈ 0 → VAD never triggers
        if (!isMutedRef.current && max > VAD_THRESHOLD) {
          if (!hasSpeechRef.current) {
            hasSpeechRef.current = true;
            speechStartRef.current = Date.now();
          }
          lastSpeechRef.current = Date.now();
        } else if (hasSpeechRef.current && lastSpeechRef.current) {
          const silence = Date.now() - lastSpeechRef.current;
          const speechDur =
            lastSpeechRef.current - (speechStartRef.current ?? lastSpeechRef.current);
          if (silence >= SILENCE_DURATION_MS && speechDur >= MIN_SPEECH_DURATION_MS) {
            recorder.stop();
            return;
          }
        }
        levelLoopRef.current = requestAnimationFrame(vadTick);
      };
      levelLoopRef.current = requestAnimationFrame(vadTick);
    };
  }, []); // empty deps — everything via refs

  const start = useCallback(async () => {
    setError(null);
    setState("requesting_permission");
    isEndingRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      setError("Microphone permission denied or unavailable.");
      setState("error");
      return;
    }
    streamRef.current = stream;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Session-level mic recorder for the end() audio blob
    try {
      const sr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      sr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      sr.start(1000);
      sessionRecorderRef.current = sr;
    } catch {
      /* MediaRecorder unavailable */
    }

    setState("connecting");
    await sendTurnRef.current(new Blob(), true);
  }, []);

  const end = useCallback(async (): Promise<{
    audioBlob: Blob | null;
    transcript: VoiceTurn[];
  }> => {
    setState("ended");
    isEndingRef.current = true;

    let audioBlob: Blob | null = null;
    if (sessionRecorderRef.current && sessionRecorderRef.current.state !== "inactive") {
      try {
        await new Promise<void>((resolve) => {
          sessionRecorderRef.current!.onstop = () => resolve();
          sessionRecorderRef.current!.stop();
        });
        audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      } catch {
        /* ignore */
      }
    }

    const finalTranscript = transcriptRef.current;
    cleanup();
    return { audioBlob, transcript: finalTranscript };
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMutedRef.current;
    });
  }, []);

  return { state, transcript, audioLevel, isMuted, error, start, end, toggleMute };
}
