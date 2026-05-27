import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAllProjects, deleteProject, DELIVERABLE_LABELS, type DeliverableType } from "@/lib/projects.functions";
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
import { FolderKanban, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: AllProjects,
});

function AllProjects() {
  const fetchAll = useServerFn(listAllProjects);
  const remove = useServerFn(deleteProject);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["projects", "all"],
    queryFn: () => fetchAll(),
  });

  const projects = data ?? [];
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove({ data: { project_id: pendingDelete.id } });
      qc.invalidateQueries({ queryKey: ["projects", "all"] });
      toast.success("Project deleted");
      setPendingDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-foreground">All projects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every take-home project across all your jobs.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && projects.length === 0 && (
        <div className="editorial-card p-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-serif text-xl text-foreground">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open any job, click Projects, and paste a take-home brief to start.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <div key={p.id} className="group relative">
            <Link
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="editorial-card block p-4 pr-10"
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {DELIVERABLE_LABELS[(p.deliverable_type ?? "custom") as DeliverableType] ?? "Project"}
              </p>
              <p className="mt-2 font-medium text-foreground">{p.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.company_name ? `${p.company_name} · ` : ""}
                {p.job_title ?? ""}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                {p.status ? ` · ${p.status}` : ""}
              </p>
            </Link>
            <button
              className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setPendingDelete({ id: p.id, title: p.title })}
              title="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.title}</strong> — along with its research, outline, and all drafted sections — will be permanently removed. This can't be undone.
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
