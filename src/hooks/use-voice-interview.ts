import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useVoiceInterview — drives an OpenAI Realtime voice session via WebRTC.
 *
 * Flow:
 * 1. Requests mic permission
 * 2. POSTs to /api/voice-token with system instructions + voice name;
 *    server creates an OpenAI Realtime session and returns a short-lived
 *    client_secret (ephemeral token valid ~60 s)
 * 3. Creates an RTCPeerConnection, adds the mic track, opens a data channel
 *    for server events, creates an SDP offer
 * 4. Exchanges SDP with api.openai.com/v1/realtime using the ephemeral token
 * 5. On data-channel open, sends response.create to trigger the AI opening
 * 6. Plays AI audio via a hidden <audio> element (WebRTC delivers Opus;
 *    no PCM16 decode or AudioWorklet needed)
 * 7. Accumulates transcript from input_audio_transcription + audio_transcript events
 * 8. Muting disables the mic track — WebRTC stops sending audio to OpenAI
 */

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
  /** OpenAI Realtime voice name: alloy | ash | ballad | coral | echo | sage | shimmer | verse */
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

export function useVoiceInterview(opts: VoiceInterviewOptions): VoiceInterview {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelLoopRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isMutedRef = useRef(false);
  const interimAssistantRef = useRef("");

  const cleanup = useCallback(() => {
    if (levelLoopRef.current != null) {
      cancelAnimationFrame(levelLoopRef.current);
      levelLoopRef.current = null;
    }
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (_) {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.parentNode?.removeChild(audioElRef.current);
      audioElRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch (_) {}
      recorderRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setState("requesting_permission");

    // 1. Mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("Microphone permission denied or unavailable.");
      setState("error");
      return;
    }
    streamRef.current = stream;

    // 2. Create OpenAI Realtime session — instructions and voice baked in server-side
    setState("connecting");
    let clientSecret: string;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) {
        setError("Not authenticated.");
        setState("error");
        cleanup();
        return;
      }
      const res = await fetch("/api/voice-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructions: opts.systemInstruction,
          voice: opts.voiceName ?? "alloy",
        }),
      });
      const data = await res.json() as { voice_available: boolean; client_secret?: { value: string }; error?: string };
      if (!data.voice_available || !data.client_secret?.value) {
        setError(data.error ?? "Voice mode not available.");
        setState("error");
        cleanup();
        return;
      }
      clientSecret = data.client_secret.value;
    } catch {
      setError("Could not get voice session.");
      setState("error");
      cleanup();
      return;
    }

    // 3. WebRTC peer connection
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    // Hidden audio element — WebRTC delivers AI audio as an Opus track;
    // attaching it to an <audio> element lets the browser decode and play it natively.
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);
    audioElRef.current = audioEl;
    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => undefined);
    };

    // Mic as send track (sendrecv transceiver — also opens receive path for AI audio)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    // Data channel for Realtime API events
    const dc = pc.createDataChannel("oai-events");
    dcRef.current = dc;

    dc.onopen = () => {
      // Session is fully configured (instructions/voice set during session creation).
      // Trigger the interviewer's opening statement.
      dc.send(JSON.stringify({ type: "response.create" }));
      setState("listening");
    };

    dc.onmessage = (e) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(e.data as string); } catch { return; }
      const type = msg.type as string;

      // AI speech — accumulate delta, commit on done
      if (type === "response.audio_transcript.delta") {
        interimAssistantRef.current += (msg.delta as string) ?? "";
      }
      if (type === "response.audio_transcript.done") {
        const text = ((msg.transcript as string) ?? interimAssistantRef.current).trim();
        interimAssistantRef.current = "";
        if (text) {
          setTranscript((t) => [...t, { role: "interviewer", content: text, timestamp: new Date().toISOString() }]);
        }
      }

      // User speech (transcribed by Whisper server-side)
      if (type === "conversation.item.input_audio_transcription.completed") {
        const text = ((msg.transcript as string) ?? "").trim();
        if (text) {
          setTranscript((t) => [...t, { role: "candidate", content: text, timestamp: new Date().toISOString() }]);
        }
      }

      // State transitions
      if (type === "response.audio.delta") setState("speaking");
      if (type === "response.done") setState("listening");
      if (type === "input_audio_buffer.speech_started") setState("listening");

      if (type === "error") {
        console.error("Realtime API error:", msg);
        const errMsg = (msg.error as { message?: string } | undefined)?.message ?? "Realtime API error";
        setError(errMsg);
        setState("error");
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("Voice connection lost.");
        setState("error");
      }
    };

    // 4. SDP offer → OpenAI → SDP answer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!sdpRes.ok) {
      const errText = await sdpRes.text();
      setError(`WebRTC handshake failed: ${errText}`);
      setState("error");
      cleanup();
      return;
    }

    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // 5. Mic audio level meter for the visualiser bar
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
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

    // 6. Record mic side for session log
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) recordedChunksRef.current.push(ev.data); };
      recorder.start(1000);
    } catch (_) {}

  }, [opts.systemInstruction, opts.voiceName, cleanup]);

  const end = useCallback(async (): Promise<{ audioBlob: Blob | null; transcript: VoiceTurn[] }> => {
    setState("ended");
    let audioBlob: Blob | null = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        await new Promise<void>((resolve) => {
          recorderRef.current!.onstop = () => resolve();
          recorderRef.current!.stop();
        });
        audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      } catch (_) {}
    }
    cleanup();
    return { audioBlob, transcript };
  }, [transcript, cleanup]);

  const toggleMute = useCallback(() => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
    // Disabling the track stops WebRTC from sending audio to OpenAI
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !isMutedRef.current; });
  }, []);

  return { state, transcript, audioLevel, isMuted, error, start, end, toggleMute };
}
