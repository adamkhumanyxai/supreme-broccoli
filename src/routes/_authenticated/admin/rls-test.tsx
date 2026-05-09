import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/rls-test")({
  component: RlsTest,
});

type Result = { table: string; ok: boolean; count: number; error?: string };

function RlsTest() {
  const { user } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    setResults([]);
    const tables: ("jobs" | "insights" | "interview_sessions" | "projects" | "companies")[] = [
      "jobs",
      "insights",
      "interview_sessions",
      "projects",
      "companies",
    ];
    const out: Result[] = [];
    for (const t of tables) {
      try {
        const { data, error } = await supabase.from(t).select("user_id");
        if (error) {
          out.push({ table: t, ok: false, count: 0, error: error.message });
        } else {
          const wrong = (data ?? []).filter((r: { user_id: string | null }) => r.user_id !== user?.id);
          out.push({
            table: t,
            ok: wrong.length === 0,
            count: data?.length ?? 0,
            error: wrong.length > 0 ? `${wrong.length} rows leaked from other users!` : undefined,
          });
        }
      } catch (e) {
        out.push({ table: t, ok: false, count: 0, error: (e as Error).message });
      }
    }
    setResults(out);
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-foreground">RLS isolation test</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Direct queries against each user-data table without filtering by user_id. Should return only
          your rows.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Signed in as: <span className="font-mono text-foreground">{user?.email}</span> ·{" "}
          <span className="font-mono text-muted-foreground">{user?.id}</span>
        </p>
      </div>

      <Button onClick={runAll} disabled={running}>
        {running ? "Running…" : "Run RLS check"}
      </Button>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.table}
              className={`editorial-card flex items-start gap-3 p-4 ${
                r.ok ? "" : "border-destructive/60"
              }`}
            >
              {r.ok ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              )}
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  <span className="font-mono">{r.table}</span> · {r.count} rows
                </p>
                {r.error && <p className="mt-1 text-sm text-destructive">{r.error}</p>}
                {r.ok && (
                  <p className="mt-1 text-xs text-muted-foreground">All rows belong to current user.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
