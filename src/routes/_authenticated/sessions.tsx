import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/lib/interview.functions";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { MessagesSquare, Mic } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsList,
});

function SessionsList() {
  const navigate = useNavigate();
  const fetch = useServerFn(listSessions);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetch(),
  });

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
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} />
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
                  <Link
                    to="/jobs/$jobId/mock/$sessionId/debrief"
                    params={{ jobId: s.job_id, sessionId: s.id }}
                    className="text-primary hover:underline"
                  >
                    {s.status === "completed" ? "Debrief" : "Open"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
