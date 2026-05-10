import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listInsightHistory } from "@/lib/jobs.functions";
import { DOSSIER_SECTIONS, type Dossier } from "@/lib/insights.functions";
import { DossierSection } from "@/components/jobs/DossierSection";
import { EmployerScoreCard } from "@/components/jobs/EmployerScoreCard";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { jobId } = Route.useParams();
  const fetchHistory = useServerFn(listInsightHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["insight-history", jobId],
    queryFn: () => fetchHistory({ data: { job_id: jobId } }),
  });

  return (
    <div className="space-y-6">
      <Link
        to="/jobs/$jobId"
        params={{ jobId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to dossier
      </Link>

      <div>
        <h2 className="font-serif text-3xl text-foreground">Version history</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every dossier ever generated for this job.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      )}

      <Accordion type="multiple" className="space-y-3">
        {(data || []).map((row) => {
          const dossier = (row.dossier ?? null) as Dossier | null;
          return (
            <AccordionItem key={row.id} value={row.id} className="editorial-card border-0 px-5">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                  <span className="font-medium text-foreground">
                    Version {row.version}
                    {row.is_current && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.generated_at ? format(new Date(row.generated_at), "PP p") : "—"}
                    {row.model ? ` • ${row.model}` : ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {row.error && (
                  <p className="text-sm text-destructive">Error: {row.error}</p>
                )}
                {dossier ? (
                  <div className="space-y-3">
                    {DOSSIER_SECTIONS.map((s) => {
                      if (s.key === "employer_brand") {
                        return dossier.employer_brand ? (
                          <EmployerScoreCard
                            key={s.key}
                            id={`${row.id}-${s.key}`}
                            brand={dossier.employer_brand}
                          />
                        ) : null;
                      }
                      const content = dossier[s.key as keyof Omit<Dossier, "employer_brand">] as string | undefined;
                      return (
                        <DossierSection
                          key={s.key}
                          id={`${row.id}-${s.key}`}
                          title={s.title}
                          icon={s.icon}
                          content={content ?? ""}
                        />
                      );
                    })}
                  </div>
                ) : (
                  !row.error && <p className="text-sm text-muted-foreground">No content.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
