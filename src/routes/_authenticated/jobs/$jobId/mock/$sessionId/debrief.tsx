import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSession,
  generateDebrief,
  startInterview,
  SCORE_DIMENSIONS,
  type Debrief,
  type Persona,
  type InterviewType,
  type Difficulty,
} from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Loader2, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/mock/$sessionId/debrief")({
  component: DebriefPage,
});

function DebriefPage() {
  const { jobId, sessionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchSession = useServerFn(getSession);
  const gen = useServerFn(generateDebrief);
  const start = useServerFn(startInterview);
  // Track whether we've already kicked off generation to avoid firing it repeatedly via refetch polling.
  const generationKickedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["session", sessionId, "debrief"],
    queryFn: async () => {
      const s = await fetchSession({ data: { session_id: sessionId } });
      if (!s.session.debrief && !generationKickedRef.current) {
        generationKickedRef.current = true;
        await gen({ data: { session_id: sessionId } });
        return await fetchSession({ data: { session_id: sessionId } });
      }
      return s;
    },
    refetchInterval: (q) => (q.state.data?.session.debrief ? false : 4000),
  });

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  const debrief = data.session.debrief as Debrief | null;
  if (!debrief) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Generating debrief…</p>
      </div>
    );
  }

  async function rerun(sameSetup: boolean) {
    const persona = (data!.session.persona ?? { title: "Hiring Manager", seniority: "", style: "" }) as Persona;
    if (sameSetup) {
      const { session_id } = await start({
        data: {
          job_id: jobId,
          interview_type: (data!.session.interview_type ?? "behavioral") as InterviewType,
          persona,
          difficulty: (data!.session.difficulty ?? "standard") as Difficulty,
          target_duration_minutes: data!.session.target_duration_minutes ?? 30,
        },
      });
      navigate({
        to: "/jobs/$jobId/mock/$sessionId",
        params: { jobId, sessionId: session_id },
      });
    } else {
      navigate({ to: "/jobs/$jobId/mock/new", params: { jobId } });
    }
  }

  return (
    <div className="space-y-10">
      <AudioPlayback audioPath={(data.session as { audio_url?: string | null }).audio_url ?? null} />
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Debrief</p>
        <div className="flex items-end gap-6">
          <div className="font-serif text-7xl text-foreground tabular-nums">
            {debrief.overall_score.toFixed(1)}
          </div>
          <div className="mb-2 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-5 w-5 ${
                  n <= Math.round(debrief.overall_score)
                    ? "fill-amber-500 text-amber-500"
                    : "text-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="max-w-2xl text-foreground">{debrief.headline}</p>
      </div>

      <section className="space-y-3">
        <h3 className="font-serif text-xl text-foreground">Score breakdown</h3>
        <div className="space-y-2">
          {SCORE_DIMENSIONS.map((d) => {
            const s = debrief.scores[d.key];
            return (
              <Collapsible key={d.key}>
                <div className="editorial-card p-4">
                  <CollapsibleTrigger className="flex w-full items-center gap-4 text-left">
                    <span className="w-48 shrink-0 text-sm text-foreground">{d.label}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 bg-amber-500"
                        style={{ width: `${(s.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-foreground">
                      {s.score}/5
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                    {s.evidence}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-serif text-xl text-foreground">Strengths</h3>
          {debrief.strengths.map((s, i) => (
            <div key={i} className="editorial-card p-4">
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h3 className="font-serif text-xl text-foreground">Gaps</h3>
          {debrief.gaps.map((s, i) => (
            <div key={i} className="editorial-card p-4">
              <p className="font-medium text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-xl text-foreground">Follow-up questions to expect</h3>
        <ul className="list-decimal space-y-2 pl-6 text-sm text-foreground">
          {debrief.follow_up_questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      <section className="editorial-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Re-run suggestion</p>
        <p className="mt-2 text-sm text-foreground">{debrief.rerun_suggestion}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => rerun(true)}>Re-run this interview</Button>
        <Button variant="outline" onClick={() => rerun(false)}>
          Try a different angle
        </Button>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ChevronDown className="h-4 w-4" /> Read full transcript
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {data.session.transcript.map((t, i) => (
            <div
              key={i}
              className="editorial-card p-4 text-sm"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.role === "interviewer" ? "Interviewer" : "You"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{t.content}</p>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      
    </div>
  );
}

function AudioPlayback({ audioPath }: { audioPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!audioPath) return;
    supabase.storage
      .from("user-files")
      .createSignedUrl(audioPath, 60 * 60)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [audioPath]);
  if (!audioPath) return null;
  return (
    <div className="editorial-card p-4">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Voice recording
      </p>
      {url ? (
        <audio controls src={url} className="w-full" />
      ) : (
        <p className="text-xs text-muted-foreground">Loading audio…</p>
      )}
    </div>
  );
}
