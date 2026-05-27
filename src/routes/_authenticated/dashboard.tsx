import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { profileCompleteness, type ProfileRow } from "@/lib/profile";
import { ArrowRight, Plus } from "lucide-react";
import { listSessions, SCORE_DIMENSIONS, type Debrief } from "@/lib/interview.functions";
import { listJobs } from "@/lib/jobs.functions";
import { JOB_STATUSES } from "@/components/jobs/StatusPill";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score < 3) return "text-rose-400";
  if (score < 4) return "text-amber-400";
  return "text-emerald-400";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-muted/30";
  if (score < 3) return "bg-rose-950/40 ring-rose-900/40";
  if (score < 4) return "bg-amber-950/40 ring-amber-900/40";
  return "bg-emerald-950/40 ring-emerald-900/40";
}

function interviewTypeBadge(type: string | null): string {
  const map: Record<string, string> = {
    behavioral: "Behavioral",
    role_specific: "Role-specific",
    panel: "Panel",
    executive: "Executive",
    general: "General",
  };
  return type ? (map[type] ?? type) : "Interview";
}

// ── sub-components ────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof listSessions>>[number];

function SessionCard({ session }: { session: Session }) {
  const score = session.overall_score ?? null;
  return (
    <Link
      to="/sessions"
      className={`editorial-card block p-5 ring-1 ring-inset transition-colors hover:bg-card/80 ${scoreBg(score)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            {session.company_name ?? "Unknown company"}
          </p>
          <p className="mt-1 truncate font-serif text-base text-foreground">
            {session.job_title ?? "Unknown role"}
          </p>
        </div>
        {score !== null && (
          <span className={`shrink-0 font-serif text-2xl font-semibold leading-none ${scoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset bg-zinc-800 text-zinc-300 ring-zinc-700">
          {interviewTypeBadge(session.interview_type)}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(session.started_at)}</span>
      </div>
    </Link>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, headline, superpowers, resume_file_url, domain")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listSessions(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
  });

  const pct = profileCompleteness(profile);
  const name = profile?.full_name?.trim().split(" ")[0] || "there";

  // Section 1: top 3 completed sessions (already ordered by started_at desc)
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const recentSessions = completedSessions.slice(0, 3);

  // Section 2: jobs pipeline counts
  const statusCounts = JOB_STATUSES.map((status) => ({
    status,
    count: jobs.filter((j) => j.status === status).length,
  })).filter((item) => item.count > 0);

  // Section 3: weakest dimension across all sessions with debriefs
  const sessionsWithDebrief = sessions.filter(
    (s): s is Session & { debrief: Debrief } => s.debrief !== null,
  );

  let weakestDimension: { key: keyof Debrief["scores"]; label: string; avg: number } | null = null;
  if (sessionsWithDebrief.length > 0) {
    const dimAverages = SCORE_DIMENSIONS.map(({ key, label }) => {
      const scores = sessionsWithDebrief
        .map((s) => s.debrief.scores[key]?.score ?? null)
        .filter((v): v is number => v !== null);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return { key, label, avg };
    }).filter((d): d is { key: keyof Debrief["scores"]; label: string; avg: number } => d.avg !== null);

    if (dimAverages.length > 0) {
      weakestDimension = dimAverages.reduce((min, d) => (d.avg < min.avg ? d : min));
    }
  }

  const statusLabels: Record<string, string> = {
    prospecting: "Prospecting",
    interviewing: "Interviewing",
    offer: "Offer",
    closed: "Closed",
  };

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h2 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">
            Hello, {name}.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Your command center for interview prep — track jobs, review sessions, and sharpen your weakest areas.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate({ to: "/jobs/new" })} className="h-11 shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Add a job
        </Button>
      </div>

      {/* Profile completeness */}
      <Link to="/profile" className="editorial-card block p-6 group">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Profile</p>
            <h3 className="mt-2 font-serif text-xl text-foreground">
              Profile completeness: {loading ? "…" : `${pct}%`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The more we know about you, the more personalized your prep becomes.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <Progress value={pct} className="mt-5 h-1.5" />
      </Link>

      {/* Section 1: Recent mock sessions */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-xl text-foreground">Recent mock sessions</h3>
          <Link to="/sessions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <div className="editorial-card flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-muted-foreground">No completed sessions yet.</p>
            <Button variant="outline" onClick={() => navigate({ to: "/jobs" })}>
              Run your first mock interview
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Jobs pipeline summary */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-xl text-foreground">Jobs pipeline</h3>
          <Link to="/jobs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all jobs →
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="editorial-card flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-muted-foreground">No jobs added yet. Start by adding a job.</p>
            <Button onClick={() => navigate({ to: "/jobs/new" })}>
              <Plus className="mr-2 h-4 w-4" /> Add a job
            </Button>
          </div>
        ) : (
          <div className="editorial-card p-5">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {statusCounts.length > 0 ? (
                statusCounts.map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-2">
                    <span className="text-2xl font-serif font-semibold text-foreground">{count}</span>
                    <span className="text-sm text-muted-foreground">{statusLabels[status] ?? status}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">All jobs added — update their status as you progress.</p>
              )}
            </div>
            {statusCounts.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"} total
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Weakest dimension callout */}
      {weakestDimension && (
        <div className="space-y-4">
          <h3 className="font-serif text-xl text-foreground">Focus area</h3>
          <Link to="/sessions" className="editorial-card block p-6 group ring-1 ring-inset bg-amber-950/20 ring-amber-900/40 hover:bg-amber-950/30 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-400/80">Needs work</p>
                <h4 className="mt-2 font-serif text-xl text-foreground">{weakestDimension.label}</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  Averaging {weakestDimension.avg.toFixed(1)} / 5 across your sessions. Keep practicing — review your session debriefs for targeted feedback.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`font-serif text-3xl font-semibold leading-none ${scoreColor(weakestDimension.avg)}`}>
                  {weakestDimension.avg.toFixed(1)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
