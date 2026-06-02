import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
} from "recharts";
import { format } from "date-fns";
import { MessagesSquare, Mic, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsList,
});

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

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
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

  const chartData = sessions
    .filter((s) => s.overall_score != null && s.started_at)
    .slice()
    .reverse()
    .map((s) => ({
      date: format(new Date(s.started_at!), "MMM d"),
      score: s.overall_score,
    }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">All mock interviews</p>
        <h2 className="mt-1 font-serif text-3xl text-foreground">Your sessions</h2>
      </div>

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
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
            {sessions.map((s) => (
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
                      onClick={() =>
                        setPendingDelete({
                          id: s.id,
                          label: `${s.company_name ? `${s.company_name} · ` : ""}${s.job_title ?? "session"} — ${s.started_at ? format(new Date(s.started_at), "MMM d") : ""}`,
                        })
                      }
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

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.label}</strong> — along with its transcript and feedback —
              will be permanently removed. This can't be undone.
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
