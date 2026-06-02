import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  listProjectsForJob,
  DELIVERABLE_LABELS,
  type DeliverableType,
} from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/projects/")({
  component: JobProjectsList,
});

function JobProjectsList() {
  const { jobId } = Route.useParams();
  const fetchProjects = useServerFn(listProjectsForJob);
  const { data, isLoading } = useQuery({
    queryKey: ["projects", "byJob", jobId],
    queryFn: () => fetchProjects({ data: { job_id: jobId } }),
  });

  const projects = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-3xl text-foreground">Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Take-home projects and presentations tied to this role.
          </p>
        </div>
        <Button asChild>
          <Link to="/jobs/$jobId/projects/new" params={{ jobId }}>
            <Plus className="mr-2 h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && projects.length === 0 && (
        <div className="editorial-card p-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-serif text-xl text-foreground">No projects yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Got a take-home assignment? Paste it here and we'll help you build something
            interview-worthy.
          </p>
          <Button asChild className="mt-5">
            <Link to="/jobs/$jobId/projects/new" params={{ jobId }}>
              <Plus className="mr-2 h-4 w-4" /> New project
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            to="/projects/$projectId"
            params={{ projectId: p.id }}
            className="editorial-card block p-4"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {DELIVERABLE_LABELS[(p.deliverable_type ?? "custom") as DeliverableType] ?? "Project"}
            </p>
            <p className="mt-2 font-medium text-foreground">{p.title}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {p.last_exported_at
                ? `Last exported ${formatDistanceToNow(new Date(p.last_exported_at), { addSuffix: true })}`
                : `Updated ${formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}`}
              {p.status ? ` · ${p.status}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
