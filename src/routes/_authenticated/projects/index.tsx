import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAllProjects, DELIVERABLE_LABELS, type DeliverableType } from "@/lib/projects.functions";
import { FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: AllProjects,
});

function AllProjects() {
  const fetchAll = useServerFn(listAllProjects);
  const { data, isLoading } = useQuery({
    queryKey: ["projects", "all"],
    queryFn: () => fetchAll(),
  });

  const projects = data ?? [];

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
            <p className="mt-1 text-xs text-muted-foreground">
              {p.company_name ? `${p.company_name} · ` : ""}
              {p.job_title ?? ""}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
              {p.status ? ` · ${p.status}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
