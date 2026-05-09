import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSession,
  interviewTurn,
  endInterview,
  generateDebrief,
  voiceSessionFinalize,
  buildVoiceSystemPrompt,
  type Persona,
  type Turn,
} from "@/lib/interview.functions";
import { useVoiceInterview } from "@/hooks/use-voice-interview";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Mic, MicOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/mock/$sessionId/")({
  component: LiveInterview,
});

function initials(title: string | undefined | null): string {
  if (!title) return "?";
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

function LiveInterview() {
  const { jobId, sessionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);

  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSession({ data: { session_id: sessionId } }),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (data.session.status === "completed") {
    navigate({
      to: "/jobs/$jobId/mock/$sessionId/debrief",
      params: { jobId, sessionId },
    });
    return null;
  }

  const isVoice = data.session.mode === "voice";
  return isVoice ? (
    <VoiceLiveInterview jobId={jobId} sessionId={sessionId} session={data.session} job={data.job} company={data.company} />
  ) : (
    <TextLiveInterview jobId={jobId} sessionId={sessionId} session={data.session} job={data.job} company={data.company} />
  );
}

// =====================================================================================
// Text mode
// =====================================================================================

type SharedProps = {
  jobId: string;
  sessionId: string;
  session: {
    persona: Persona | null;
    transcript: Turn[];
    started_at: string | null;
    target_duration_minutes: number | null;
    status: string | null;
  };
  job: { title: string | null } | null;
  company: { name: string | null } | null;
};

function TextLiveInterview({ jobId, sessionId, session, job, company }: SharedProps) {
  const navigate = useNavigate();
  const turn = useServerFn(interviewTurn);
  const end = useServerFn(endInterview);
  const debrief = useServerFn(generateDebrief);

  const [transcript, setTranscript] = useState<Turn[]>(session.transcript);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [openingFired, setOpeningFired] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!session.started_at) return;
    const start = new Date(session.started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session.started_at]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, thinking]);

  useEffect(() => {
    if (openingFired) return;
    if (transcript.length === 0 && session.status === "in_progress") {
      setOpeningFired(true);
      setThinking(true);
      turn({ data: { session_id: sessionId, candidate_message: null } })
        .then((r) => setTranscript(r.transcript))
        .catch((e) => toast.error((e as Error).message))
        .finally(() => setThinking(false));
    } else {
      setOpeningFired(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingFired, sessionId]);

  async function send() {
    const msg = input.trim();
    if (!msg || thinking) return;
    setInput("");
    const optimistic: Turn = { role: "candidate", content: msg, timestamp: new Date().toISOString() };
    setTranscript((t) => [...t, optimistic]);
    setThinking(true);
    try {
      const r = await turn({ data: { session_id: sessionId, candidate_message: msg } });
      setTranscript(r.transcript);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  async function handleEnd() {
    setEnding(true);
    try {
      await end({ data: { session_id: sessionId } });
      debrief({ data: { session_id: sessionId } }).catch(() => undefined);
      navigate({ to: "/jobs/$jobId/mock/$sessionId/debrief", params: { jobId, sessionId } });
    } catch (e) {
      toast.error((e as Error).message);
      setEnding(false);
    }
  }

  const persona = (session.persona ?? { title: "Interviewer", seniority: "", style: "" }) as Persona;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const target = session.target_duration_minutes ?? 30;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary">
            {initials(persona.title)}
          </div>
          <div>
            <p className="font-medium text-foreground">{persona.title}</p>
            <p className="text-xs text-muted-foreground">
              {job?.title} · {company?.name ?? "Unknown company"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-muted-foreground">
            {mins}:{secs.toString().padStart(2, "0")} / {target}:00
          </span>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmEnd(true)}
            disabled={ending}
          >
            End interview
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {transcript.map((t, i) => (
            <div key={i} className={`flex gap-3 ${t.role === "candidate" ? "flex-row-reverse" : ""}`}>
              {t.role === "interviewer" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {initials(persona.title)}
                </div>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  t.role === "candidate"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {initials(persona.title)}
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mx-auto max-w-3xl">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your response… (⌘/Ctrl+Enter to send)"
            rows={2}
            className="resize-none focus:rows-6"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>⌘/Ctrl+Enter to send</span>
            <Button size="sm" onClick={send} disabled={thinking || !input.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End interview now?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll get a debrief based on what's been said so far. You can't resume this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd}>
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : "End and get debrief"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================================================
// Voice mode — OpenAI Realtime via WebRTC
// =====================================================================================

function VoiceLiveInterview({ jobId, sessionId, session, job, company }: SharedProps) {
  const navigate = useNavigate();
  const buildPrompt = useServerFn(buildVoiceSystemPrompt);
  const finalize = useServerFn(voiceSessionFinalize);
  const debrief = useServerFn(generateDebrief);

  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    buildPrompt({ data: { session_id: sessionId } })
      .then((r) => setSystemPrompt(r.system))
      .catch((e) => toast.error((e as Error).message));
  }, [sessionId, buildPrompt]);

  const persona = (session.persona ?? { title: "Interviewer", seniority: "", style: "" }) as Persona;

  // Map persona seniority to an OpenAI Realtime voice
  const seniority = persona.seniority?.toLowerCase() ?? "";
  const voiceName = (seniority.includes("senior") || seniority.includes("vp") || seniority.includes("executive") || seniority.includes("director"))
    ? "echo"
    : "alloy";

  const voice = useVoiceInterview({
    systemInstruction: systemPrompt ?? "",
    voiceName,
  });

  const { state: voiceState, start: voiceStart } = voice;
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (systemPrompt && !autoStarted && voiceState === "idle") {
      setAutoStarted(true);
      voiceStart().catch(() => undefined);
    }
  }, [systemPrompt, autoStarted, voiceState, voiceStart]);

  useEffect(() => {
    if (!session.started_at) return;
    const start = new Date(session.started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [session.started_at]);

  async function handleEnd() {
    setEnding(true);
    try {
      const { audioBlob, transcript: voiceTranscript } = await voice.end();

      let audioPath: string | null = null;
      if (audioBlob) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/sessions/${sessionId}.webm`;
          const { error } = await supabase.storage
            .from("user-files")
            .upload(path, audioBlob, { upsert: true, contentType: "audio/webm" });
          if (!error) audioPath = path;
        }
      }

      await finalize({
        data: { session_id: sessionId, audio_storage_path: audioPath, transcript: voiceTranscript },
      });
      debrief({ data: { session_id: sessionId } }).catch(() => undefined);
      navigate({ to: "/jobs/$jobId/mock/$sessionId/debrief", params: { jobId, sessionId } });
    } catch (e) {
      toast.error((e as Error).message);
      setEnding(false);
    }
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const target = session.target_duration_minutes ?? 30;

  if (voice.state === "error") {
    return (
      <div className="mx-auto max-w-2xl pt-12 text-center">
        <h2 className="font-serif text-2xl text-foreground">Voice mode unavailable</h2>
        <p className="mt-3 text-sm text-muted-foreground">{voice.error}</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/jobs/$jobId/mock/new", params: { jobId } })}>
          Start a new mock
        </Button>
      </div>
    );
  }

  const stateLabel: Record<string, string> = {
    idle: "Ready",
    requesting_permission: "Asking for mic permission…",
    connecting: "Connecting…",
    listening: "Listening",
    speaking: voice.transcript.length === 0 ? "Joining…" : `${persona.title} is speaking`,
    ended: "Ended",
    error: "Error",
  };
  const stateColor =
    voice.state === "speaking"
      ? "text-primary"
      : voice.state === "listening"
      ? "text-emerald-400"
      : "text-muted-foreground";

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary ${
              voice.state === "speaking" ? "ring-2 ring-primary animate-pulse" : ""
            }`}
          >
            {initials(persona.title)}
          </div>
          <div>
            <p className="font-medium text-foreground">{persona.title}</p>
            <p className="text-xs text-muted-foreground">
              {job?.title} · {company?.name ?? "Unknown company"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${stateColor}`}>{stateLabel[voice.state]}</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {mins}:{secs.toString().padStart(2, "0")} / {target}:00
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
        <div className="text-center">
          <div
            className={`mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-primary/15 font-serif text-3xl text-primary transition-transform ${
              voice.state === "speaking" ? "scale-105" : ""
            }`}
          >
            {initials(persona.title)}
          </div>
          <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${Math.min(100, voice.audioLevel * 250)}%` }}
            />
          </div>
        </div>

        <div className="w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4">
          {voice.transcript.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {voice.state === "connecting" || voice.state === "requesting_permission"
                ? "Connecting…"
                : "Speak when you're ready. Interrupt anytime."}
            </p>
          )}
          {voice.transcript.map((t, i) => (
            <div key={i} className={`flex ${t.role === "candidate" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  t.role === "candidate"
                    ? "bg-primary/10 text-foreground border border-primary/30"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.role === "candidate" ? "You" : persona.title}
                </span>
                {t.content}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3">
          <Button
            variant={voice.isMuted ? "default" : "outline"}
            onClick={voice.toggleMute}
            disabled={voice.state !== "listening" && voice.state !== "speaking"}
          >
            {voice.isMuted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {voice.isMuted ? "Unmute" : "Mute"}
          </Button>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmEnd(true)}
            disabled={ending}
          >
            End interview
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End interview now?</AlertDialogTitle>
            <AlertDialogDescription>
              The recording will be saved and a debrief generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd}>
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : "End and get debrief"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
