import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listJobs, deleteJob } from "@/lib/jobs.functions";
import { StatusPill, JOB_STATUSES, type JobStatus } from "@/components/jobs/StatusPill";
import { CompanyAvatar } from "@/components/jobs/CompanyAvatar";
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
import { Plus, Loader2, AlertCircle, Sparkles, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const fetchJobs = useServerFn(listJobs);
  const remove = useServerFn(deleteJob);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => fetchJobs(),
  });

  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove({ data: { job_id: pendingDelete.id } });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job deleted");
      setPendingDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

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
                  <div key={j.id} className="group relative">
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: j.id }}
                      className="editorial-card flex items-start gap-4 p-4 pr-10 block"
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
                    <button
                      className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete({ id: j.id, title: j.title })}
                      title="Delete job"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.title}</strong> — along with its dossier, all mock sessions, and any projects — will be permanently removed. This can't be undone.
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
