import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listSessions, deleteSession } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { format } from "date-fns";
import { MessagesSquare, Mic, Trash2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsList,
});

const RADAR_DIMENSIONS = [
  { key: "clarity_communication" as const, label: "Clarity" },
  { key: "depth_substance" as const, label: "Depth" },
  { key: "structure" as const, label: "Structure" },
  { key: "role_fit" as const, label: "Role Fit" },
  { key: "domain_mastery" as const, label: "Domain" },
  { key: "strategic_thinking" as const, label: "Strategy" },
  { key: "authenticity" as const, label: "Authenticity" },
];

function SessionsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetch = useServerFn(listSessions);
  const remove = useServerFn(deleteSession);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetch(),
  });

  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>("all");

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove({ data: { session_id: pendingDelete.id } });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session deleted");
      setPendingDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
  const sessions = data ?? [];

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <MessagesSquare className="h-10 w-10 text-muted-foreground" />
        <h2 className="font-serif text-2xl text-foreground">
          Run your first mock interview to see how you're doing.
        </h2>
        <Button onClick={() => navigate({ to: "/jobs" })}>Pick a job to start</Button>
      </div>
    );
  }

  // Unique jobs for filter pills
  const uniqueJobs = useMemo(() => {
    const seen = new Map<string, { key: string; label: string }>();
    for (const s of sessions) {
      const label = [s.company_name, s.job_title].filter(Boolean).join(" · ") || "Unknown job";
      const key = `${s.job_id}`;
      if (!seen.has(key)) seen.set(key, { key, label });
    }
    return Array.from(seen.values());
  }, [sessions]);

  // Filtered sessions based on selected job
  const filteredSessions = useMemo(
    () =>
      selectedJob === "all"
        ? sessions
        : sessions.filter((s) => s.job_id === selectedJob),
    [sessions, selectedJob],
  );

  // Line chart data (filtered)
  const chartData = filteredSessions
    .filter((s) => s.overall_score != null && s.started_at)
    .slice()
    .reverse()
    .map((s) => ({
      date: format(new Date(s.started_at!), "MMM d"),
      score: s.overall_score,
    }));

  // Radar chart: average per dimension across completed sessions with debriefs (filtered)
  const radarData = useMemo(() => {
    const debriefSessions = filteredSessions.filter(
      (s) => s.status === "completed" && s.debrief?.scores,
    );
    if (debriefSessions.length === 0) return null;
    return RADAR_DIMENSIONS.map(({ key, label }) => {
      const sum = debriefSessions.reduce((acc, s) => {
        const dim = s.debrief?.scores?.[key];
        return acc + (dim?.score ?? 0);
      }, 0);
      return {
        dimension: label,
        avg: parseFloat((sum / debriefSessions.length).toFixed(2)),
      };
    });
  }, [filteredSessions]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">All mock interviews</p>
        <h2 className="mt-1 font-serif text-3xl text-foreground">Your sessions</h2>
      </div>

      {/* Charts row */}
      {(chartData.length > 0 || radarData) && (
        <div className="grid gap-4 md:grid-cols-2">
          {chartData.length > 0 && (
            <div className="editorial-card p-5">
              <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Score over time
              </p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {radarData && (
            <div className="editorial-card p-5">
              <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Avg. score by dimension
              </p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 5]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickCount={4}
                    />
                    <Radar
                      dataKey="avg"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job filter pills */}
      {uniqueJobs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedJob("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedJob === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:bg-accent/80"
            }`}
          >
            All
          </button>
          {uniqueJobs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedJob(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedJob === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:bg-accent/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="editorial-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Job</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Persona</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">
                  {s.started_at ? format(new Date(s.started_at), "MMM d, h:mm a") : "—"}
                </td>
                <td className="px-4 py-3 text-foreground">
                  <span className="inline-flex items-center gap-2">
                    {s.mode === "voice" && (
                      <Mic className="h-3.5 w-3.5 text-primary" aria-label="Voice session" />
                    )}
                    <span>
                      {s.company_name ? `${s.company_name} · ` : ""}
                      {s.job_title ?? "—"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.interview_type ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.persona?.title ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {s.overall_score != null ? s.overall_score.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-3">
                    <Link
                      to="/jobs/$jobId/mock/$sessionId/debrief"
                      params={{ jobId: s.job_id, sessionId: s.id }}
                      className="text-primary hover:underline"
                    >
                      {s.status === "completed" ? "Debrief" : "Open"}
                    </Link>
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete({
                        id: s.id,
                        label: `${s.company_name ? `${s.company_name} · ` : ""}${s.job_title ?? "session"} — ${s.started_at ? format(new Date(s.started_at), "MMM d") : ""}`,
                      })}
                      title="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.label}</strong> — along with its transcript and feedback — will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
