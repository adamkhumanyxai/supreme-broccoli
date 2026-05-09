import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getFunnelCounts } from "@/lib/settings.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/funnel")({
  component: Funnel,
});

const FUNNEL_STEPS: { key: string; label: string; blurb: string }[] = [
  { key: "profile_completed", label: "Profile completed", blurb: "Finished onboarding wizard" },
  { key: "job_added", label: "Jobs added", blurb: "Pasted a JD or URL" },
  { key: "dossier_generated", label: "Dossiers generated", blurb: "AI insights produced" },
  { key: "mock_completed", label: "Mocks completed", blurb: "Text or voice mock ended" },
  { key: "project_exported", label: "Project exports", blurb: "PPTX / DOCX / HTML download" },
];

function Funnel() {
  const fetch = useServerFn(getFunnelCounts);
  const { data, isLoading } = useQuery({
    queryKey: ["funnel"],
    queryFn: () => fetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const counts = data ?? {};
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-foreground">Your activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quiet personal funnel — counts are scoped to your account only.
        </p>
      </div>

      <div className="space-y-3">
        {FUNNEL_STEPS.map((s) => {
          const count = counts[s.key] ?? 0;
          const pct = (count / max) * 100;
          return (
            <div key={s.key} className="editorial-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-foreground">{s.label}</p>
                <p className="font-serif text-2xl tabular-nums text-foreground">{count}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.blurb}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
