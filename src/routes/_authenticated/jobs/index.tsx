import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/jobs.functions";
import { StatusPill, JOB_STATUSES, type JobStatus } from "@/components/jobs/StatusPill";
import { CompanyAvatar } from "@/components/jobs/CompanyAvatar";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const fetchJobs = useServerFn(listJobs);
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fetchJobs(),
  });

  const grouped: Record<string, NonNullable<typeof data>> = {
    prospecting: [],
    interviewing: [],
    offer: [],
    closed: [],
  };
  (data || []).forEach((j) => {
    (grouped[j.status] ?? grouped.prospecting).push(j);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-3xl text-foreground">Your jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every role you're tracking, with its dossier status.
          </p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="mr-2 h-4 w-4" /> New job
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {!isLoading && data && data.length === 0 && (
        <div className="editorial-card p-10 text-center">
          <p className="font-serif text-xl text-foreground">No jobs yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste a job description to generate your first dossier.
          </p>
          <Button asChild className="mt-5">
            <Link to="/jobs/new">
              <Plus className="mr-2 h-4 w-4" /> New job
            </Link>
          </Button>
        </div>
      )}

      {data &&
        JOB_STATUSES.map((status) => {
          const items = grouped[status];
          if (!items?.length) return null;
          return (
            <section key={status} className="space-y-3">
              <div className="flex items-center gap-3">
                <StatusPill status={status as JobStatus} />
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((j) => (
                  <Link
                    key={j.id}
                    to="/jobs/$jobId"
                    params={{ jobId: j.id }}
                    className="editorial-card flex items-start gap-4 p-4"
                  >
                    <CompanyAvatar name={j.company?.name} logoUrl={j.company?.logo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{j.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {j.company?.name ?? "Unknown company"}
                        {j.company?.hq_location ? ` • ${j.company.hq_location}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {j.current_insight?.error ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-3 w-3" /> Generation failed
                          </span>
                        ) : j.current_insight?.generated_at ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <Sparkles className="h-3 w-3" /> Dossier ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                          </span>
                        )}
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(j.updated_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
