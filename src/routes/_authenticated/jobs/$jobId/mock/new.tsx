import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { startInterview, setSessionMode, type InterviewType, type Difficulty, type Persona } from "@/lib/interview.functions";
import { getPersonaSuggestions, INTERVIEW_TYPE_OPTIONS } from "@/lib/interview-personas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/mock/new")({
  component: MockNew,
});

const DIFFICULTIES: { value: Difficulty; label: string; blurb: string }[] = [
  { value: "warmup", label: "Warmup", blurb: "Open-ended, kind." },
  { value: "standard", label: "Standard", blurb: "Realistic rigor." },
  { value: "pressure", label: "Pressure", blurb: "Probes hard." },
];

const DURATIONS = [15, 30, 45, 60];

function MockNew() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const start = useServerFn(startInterview);
  const setMode = useServerFn(setSessionMode);

  const [domain, setDomain] = useState<string | null>(null);
  const [type, setType] = useState<InterviewType>("behavioral");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [duration, setDuration] = useState<number>(30);
  const [persona, setPersona] = useState<Persona>({ title: "", seniority: "", style: "" });
  const [submitting, setSubmitting] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);

  // Probe voice availability + browser support on mount
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof RTCPeerConnection !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;
    setVoiceSupported(supported);
    if (!supported) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const jwt = session?.access_token;
        if (!jwt) return;
        fetch("/api/voice-token", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        })
          .then((r) => r.json())
          .then((d: { voice_available: boolean }) => {
            const available = !!d.voice_available;
            setVoiceAvailable(available);
            if (available) setVoiceMode(true);
          })
          .catch(() => setVoiceAvailable(false));
      });
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("domain")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data?.domain ?? null;
        setDomain(d);
        const sugg = getPersonaSuggestions(d);
        if (sugg[0]) setPersona(sugg[0]);
      });
  }, [user]);

  const suggestions = getPersonaSuggestions(domain);

  async function onStart() {
    if (!persona.title.trim()) {
      toast.error("Pick or describe an interviewer persona.");
      return;
    }
    setSubmitting(true);
    try {
      const { session_id } = await start({
        data: {
          job_id: jobId,
          interview_type: type,
          persona,
          difficulty,
          target_duration_minutes: duration,
        },
      });
      if (voiceMode && voiceSupported && voiceAvailable) {
        await setMode({ data: { session_id, mode: "voice" } }).catch(() => undefined);
      }
      navigate({
        to: "/jobs/$jobId/mock/$sessionId",
        params: { jobId, sessionId: session_id },
      });
    } catch (e) {
      toast.error((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">Mock interview</p>
        <h2 className="mt-1 font-serif text-3xl text-foreground">Set the stage</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick the format. The interviewer will use this job's dossier and your profile.
        </p>
      </div>

      <section className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {INTERVIEW_TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`editorial-card text-left p-4 transition-colors ${
                  active ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <p className="font-medium text-foreground">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Persona</Label>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => {
            const active = persona.title === s.title;
            return (
              <button
                key={s.title}
                onClick={() => setPersona(s)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={persona.title}
              onChange={(e) => setPersona({ ...persona, title: e.target.value })}
              placeholder="e.g. Engineering Manager"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seniority</Label>
            <Input
              value={persona.seniority}
              onChange={(e) => setPersona({ ...persona, seniority: e.target.value })}
              placeholder="e.g. 8–12 yrs eng"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Style</Label>
          <Textarea
            rows={2}
            value={persona.style}
            onChange={(e) => setPersona({ ...persona, style: e.target.value })}
            placeholder="e.g. Calm, structured. Probes for ownership."
          />
        </div>
      </section>

      {(voiceAvailable === true || voiceAvailable === null) && (
        <section className="space-y-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode</Label>
          <div className="editorial-card flex items-start justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Voice mode</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {!voiceSupported
                    ? "Your browser doesn't support WebRTC. Use Chrome, Edge, or Firefox."
                    : voiceAvailable === null
                    ? "Checking availability…"
                    : "Real-time voice via OpenAI Realtime. Requires mic permission. You can interrupt the interviewer mid-sentence."}
                </p>
              </div>
            </div>
            <Switch
              checked={voiceMode}
              disabled={!voiceSupported || voiceAvailable === null}
              onCheckedChange={setVoiceMode}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Difficulty</Label>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d.value;
            return (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <span className="font-medium">{d.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{d.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => {
            const active = duration === d;
            return (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {d} min
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button size="lg" onClick={onStart} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
            </>
          ) : (
            "Start interview"
          )}
        </Button>
      </div>
    </div>
  );
}
