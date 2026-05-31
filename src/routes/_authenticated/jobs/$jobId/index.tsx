import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getJob, updateJobStatus, deleteJob } from "@/lib/jobs.functions";
import { generateInsights, DOSSIER_SECTIONS, type Dossier } from "@/lib/insights.functions";
import { listSessions } from "@/lib/interview.functions";
import { listProjectsForJob } from "@/lib/projects.functions";
import { CompanyAvatar } from "@/components/jobs/CompanyAvatar";
import { StatusPill, JOB_STATUSES, type JobStatus } from "@/components/jobs/StatusPill";
import { DossierSection } from "@/components/jobs/DossierSection";
import { EmployerScoreCard } from "@/components/jobs/EmployerScoreCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Download, RefreshCcw, AlertCircle, History, ExternalLink, MessagesSquare, FolderKanban, Trash2, Loader2, CheckCircle2, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/")({
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchJob = useServerFn(getJob);
  const setStatus = useServerFn(updateJobStatus);
  const regen = useServerFn(generateInsights);
  const remove = useServerFn(deleteJob);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob({ data: { job_id: jobId } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      // Poll while there's no insight yet (generating)
      if (!d) return 3000;
      if (!d.insight) return 3000;
      return false;
    },
  });

  const { data: allSessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listSessions(),
  });

  const { data: jobProjects } = useQuery({
    queryKey: ["projects", jobId],
    queryFn: () => listProjectsForJob({ data: { job_id: jobId } }),
  });

  const [generating, setGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await remove({ data: { job_id: jobId } });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job deleted");
      navigate({ to: "/jobs" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // Auto-generate if there's no insight at all
  useEffect(() => {
    if (data && !data.insight && !generating) {
      setGenerating(true);
      regen({ data: { job_id: jobId } })
        .then(() => qc.invalidateQueries({ queryKey: ["job", jobId] }))
        .catch((e) => toast.error((e as Error).message))
        .finally(() => setGenerating(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.insight, jobId]);

  const statusMutation = useMutation({
    mutationFn: (s: JobStatus) => setStatus({ data: { job_id: jobId, status: s } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Status updated");
    },
  });

  async function onRegenerate() {
    setGenerating(true);
    try {
      await regen({ data: { job_id: jobId } });
      await refetch();
      toast.success("Dossier regenerated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {[1, 2, 3].map((n) => (
        <div key={n} className="editorial-card space-y-3 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      ))}
    </div>
  );
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const { job, company, insight } = data;
  const dossier = (insight?.dossier ?? null) as Dossier | null;
  const isError = insight?.error && !dossier;
  const isGenerating = generating || (!insight && !isError);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CompanyAvatar name={company?.name} logoUrl={company?.logo_url} size={56} />
          <div>
            <h2 className="font-serif text-3xl text-foreground">{job.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {company?.name ?? "Unknown company"}
              {company?.hq_location ? ` • ${company.hq_location}` : ""}
              {job.source_url ? (
                <>
                  {" • "}
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={job.status}
            onValueChange={(v) => statusMutation.mutate(v as JobStatus)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <StatusPill status={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onRegenerate} disabled={isGenerating}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
          <Link to="/jobs/$jobId/mock/new" params={{ jobId }}>
            <Button disabled={!dossier}>
              <MessagesSquare className="mr-2 h-4 w-4" /> Start mock interview
            </Button>
          </Link>
          <Link to="/jobs/$jobId/projects" params={{ jobId }}>
            <Button variant="outline">
              <FolderKanban className="mr-2 h-4 w-4" /> Projects
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!dossier}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => dossier && downloadMarkdown(job.title, company?.name, dossier)}
              >
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>Print / PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="icon"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (!o && !deleting) setConfirmDelete(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{job.title}</strong> — along with its dossier, all mock sessions, and any projects — will be permanently removed. This can't be undone.
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

      <PrepChecklist
        jobId={jobId}
        dossier={dossier}
        sessions={allSessions ?? []}
        projects={jobProjects ?? []}
      />

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* Sticky TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-1">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Sections</p>
            {DOSSIER_SECTIONS.map((s) => (
              <a
                key={s.key}
                href={`#${s.key}`}
                className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        {/* Body */}
        <div className="min-w-0 space-y-4">
          {isError && (
            <div className="editorial-card flex items-start gap-3 border-destructive/40 p-5">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Generation failed</p>
                <p className="mt-1 text-sm text-muted-foreground">{insight?.error}</p>
                <Button onClick={onRegenerate} className="mt-3" size="sm">
                  Try again
                </Button>
              </div>
            </div>
          )}

          {isGenerating &&
            DOSSIER_SECTIONS.map((s) => (
              <div key={s.key} className="editorial-card space-y-3 p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            ))}

          {dossier &&
            DOSSIER_SECTIONS.map((s) => {
              if (s.key === "employer_brand") {
                return dossier.employer_brand ? (
                  <EmployerScoreCard key="employer_brand" id="employer_brand" brand={dossier.employer_brand} />
                ) : null;
              }
              const content = dossier[s.key as keyof Omit<Dossier, "employer_brand">] as string | undefined;
              return (
                <DossierSection
                  key={s.key}
                  id={s.key}
                  title={s.title}
                  icon={s.icon}
                  content={content ?? ""}
                />
              );
            })}

          {insight && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
              <span>
                {insight.generated_at
                  ? `Last generated ${formatDistanceToNow(new Date(insight.generated_at), { addSuffix: true })}`
                  : "Not yet generated"}
                {insight.model ? ` • Model: ${insight.model}` : ""} • Version {insight.version}
              </span>
              {insight.version > 1 && (
                <Link
                  to="/jobs/$jobId/history"
                  params={{ jobId }}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <History className="h-3 w-3" /> View previous versions
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type PrepChecklistProps = {
  jobId: string;
  dossier: Dossier | null;
  sessions: Array<{ job_id: string; status: string | null; overall_score: number | null }>;
  projects: Array<{ id: string }>;
};

function PrepChecklist({ jobId, dossier, sessions, projects }: PrepChecklistProps) {
  const jobSessions = sessions.filter((s) => s.job_id === jobId);
  const completedSessions = jobSessions.filter((s) => s.status === "completed");
  const bestScore = completedSessions.reduce<number | null>((best, s) => {
    if (s.overall_score == null) return best;
    return best == null ? s.overall_score : Math.max(best, s.overall_score);
  }, null);

  const hasDossier = dossier != null;
  const hasMock = completedSessions.length > 0;
  const hasGoodScore = bestScore != null && bestScore >= 3.5;
  const hasProject = projects.length > 0;

  const steps: Array<{
    label: string;
    done: boolean;
    action: { label: string; to: string } | null;
  }> = [
    {
      label: "Company dossier",
      done: hasDossier,
      action: hasDossier ? null : { label: "Generate →", to: "/jobs/$jobId" },
    },
    {
      label: "Run a mock interview",
      done: hasMock,
      action: hasMock ? null : { label: "Start mock →", to: "/jobs/$jobId/mock/new" },
    },
    {
      label: "Score ≥ 3.5",
      done: hasGoodScore,
      action:
        hasGoodScore || !hasMock
          ? null
          : { label: "Start mock →", to: "/jobs/$jobId/mock/new" },
    },
    {
      label: "Start a project",
      done: hasProject,
      action: hasProject ? null : { label: "View projects →", to: "/jobs/$jobId/projects" },
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === 4;

  return (
    <div className="editorial-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Prep progress</p>
        {allDone && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Ready to interview
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            {step.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
            )}
            <span
              className={`flex-1 text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}
            >
              {step.label}
            </span>
            {!step.done && step.action && (
              <Link
                to={step.action.to}
                params={{ jobId }}
                className="text-xs text-primary hover:underline"
              >
                {step.action.label}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5">
        <Progress value={(completedCount / 4) * 100} className="h-1.5" />
        <p className="text-xs text-muted-foreground">{completedCount} / 4 complete</p>
      </div>
    </div>
  );
}

function employerBrandToMarkdown(eb: Dossier["employer_brand"]): string {
  if (!eb) return "_Employer score not available._";
  const flags = eb.red_flags.length > 0 ? `\n**Watch out for:**\n${eb.red_flags.map((f) => `- ${f}`).join("\n")}` : "";
  return [
    `**Score: ${eb.score.toFixed(1)}/10** — ${eb.score_rationale}`,
    "",
    `**What employees love:**\n${eb.pros.map((p) => `- ${p}`).join("\n")}`,
    "",
    `**Common complaints:**\n${eb.cons.map((c) => `- ${c}`).join("\n")}`,
    "",
    `**Comp:** ${eb.compensation_verdict}  |  **Equity:** ${eb.equity}  |  **Remote:** ${eb.remote_policy}`,
    "",
    `**Perks:** ${eb.perks.join(", ")}`,
    flags,
    "",
    `_${eb.verdict}_`,
  ].join("\n");
}

function downloadMarkdown(title: string, companyName: string | null | undefined, dossier: Dossier) {
  const sections = DOSSIER_SECTIONS.map((s) => {
    if (s.key === "employer_brand") {
      return `## ${s.title}\n\n${employerBrandToMarkdown(dossier.employer_brand)}\n`;
    }
    const content = dossier[s.key as keyof Omit<Dossier, "employer_brand">] as string | undefined;
    return `## ${s.title}\n\n${content ?? ""}\n`;
  });
  const md = `# ${title}\n_${companyName ?? "Company"}_\n\n` + sections.join("\n");
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(companyName ?? "company").toLowerCase().replace(/\s+/g, "-")}-dossier.md`;
  a.click();
  URL.revokeObjectURL(url);
}

