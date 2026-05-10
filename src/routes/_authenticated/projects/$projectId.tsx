import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getProject,
  runDeeperResearch,
  generateOutline,
  updateOutline,
  updatePersonalRequest,
  deleteProject,
  draftSection,
  exportProject,
  DELIVERABLE_LABELS,
  type DeliverableType,
  type OutlineSection,
  type ResearchNotes,
  type ExtractedBrief,
} from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Sparkles, Search, FileText, Download, Wand2, Minimize2, Maximize2, MessagesSquare, Lightbulb, Pencil, Check, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectWorkspace,
});

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  const fetchProject = useServerFn(getProject);
  const remove = useServerFn(deleteProject);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await remove({ data: { project_id: projectId } });
      qc.invalidateQueries({ queryKey: ["projects", "all"] });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject({ data: { project_id: projectId } }),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const project = data.project as {
    id: string;
    title: string;
    brief: string;
    extracted_brief: ExtractedBrief | null;
    outline: OutlineSection[] | null;
    research_notes: ResearchNotes | null;
    deliverable_type: DeliverableType;
    status: string | null;
    personal_request: string | null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {DELIVERABLE_LABELS[project.deliverable_type ?? "custom"]}
          </p>
          <h2 className="mt-1 font-serif text-3xl text-foreground">{project.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.company?.name ?? "Unknown company"} · {data.job?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu projectId={projectId} project={project} />
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
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{project.title}</strong> — along with its research, outline, and all drafted sections — will be permanently removed. This can't be undone.
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

      <Tabs defaultValue="brief" className="space-y-6">
        <TabsList>
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="drafting">Drafting</TabsTrigger>
        </TabsList>

        <TabsContent value="brief">
          <BriefTab project={project} onUpdate={() => qc.invalidateQueries({ queryKey: ["project", projectId] })} />
        </TabsContent>
        <TabsContent value="research">
          <ResearchTab projectId={projectId} project={project} onUpdate={() => qc.invalidateQueries({ queryKey: ["project", projectId] })} />
        </TabsContent>
        <TabsContent value="outline">
          <OutlineTab projectId={projectId} project={project} onUpdate={() => qc.invalidateQueries({ queryKey: ["project", projectId] })} />
        </TabsContent>
        <TabsContent value="drafting">
          <DraftingTab projectId={projectId} project={project} onUpdate={() => qc.invalidateQueries({ queryKey: ["project", projectId] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BriefTab({
  project,
  onUpdate,
}: {
  project: { id: string; brief: string; extracted_brief: ExtractedBrief | null; personal_request: string | null };
  onUpdate: () => void;
}) {
  const saveRequest = useServerFn(updatePersonalRequest);
  const eb = project.extracted_brief;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.personal_request ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await saveRequest({ data: { project_id: project.id, personal_request: draft } });
      onUpdate();
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(project.personal_request ?? "");
    setEditing(false);
  }

  return (
    <div className="space-y-6">
      {/* Personal request — top of the brief, always visible */}
      <div className="editorial-card space-y-3 border-primary/20 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your angle</p>
          </div>
          {!editing && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setDraft(project.personal_request ?? ""); setEditing(true); }}>
              <Pencil className="mr-1.5 h-3 w-3" /> {project.personal_request ? "Edit" : "Add angle"}
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              placeholder="e.g. I want to leverage Challenger Sales methodology throughout — position us as challenging the status quo."
              className="text-sm"
              disabled={saving}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Check className="mr-1.5 h-3 w-3" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
                <X className="mr-1.5 h-3 w-3" /> Cancel
              </Button>
            </div>
          </div>
        ) : project.personal_request ? (
          <p className="text-sm leading-relaxed text-foreground">{project.personal_request}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No angle set. Add one to shape the AI's research, outline, and drafting.
          </p>
        )}

        {!editing && project.personal_request && (
          <p className="text-xs text-muted-foreground">
            This lens is applied across all research, outline generation, and section drafting.
          </p>
        )}
      </div>

      {/* Extracted brief metadata */}
      {eb && (
        <div className="editorial-card space-y-4 p-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Extracted</p>
          <div className="grid gap-4 md:grid-cols-2">
            <KV label="Deliverable" value={DELIVERABLE_LABELS[eb.deliverable_type ?? "custom"]} />
            <KV label="Deadline" value={eb.deadline ?? "—"} />
            <KV label="Audience" value={eb.audience ?? "—"} />
            <KV label="Format" value={eb.format ?? "—"} />
          </div>
          {eb.requirements.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Requirements</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                {eb.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {eb.key_questions.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Key questions</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                {eb.key_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="editorial-card p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Original brief</p>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-foreground">{project.brief}</pre>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function ResearchTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: { research_notes: ResearchNotes | null };
  onUpdate: () => void;
}) {
  const run = useServerFn(runDeeperResearch);
  const [running, setRunning] = useState(false);

  const research = project.research_notes;

  async function start() {
    setRunning(true);
    try {
      await run({ data: { project_id: projectId } });
      onUpdate();
      toast.success("Research updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (!research) {
    return (
      <div className="editorial-card p-8 text-center">
        <Search className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-serif text-xl text-foreground">No research yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll search the web for specifics that make your deliverable substantively impressive.
        </p>
        <Button onClick={start} disabled={running} className="mt-5">
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Run research
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{research.findings.length} findings</p>
        <Button variant="outline" size="sm" onClick={start} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Re-run
        </Button>
      </div>
      <div className="space-y-3">
        {research.findings.map((f, i) => (
          <div key={i} className="editorial-card p-5">
            <p className="font-medium text-foreground">{f.topic}</p>
            <p className="mt-2 text-sm text-muted-foreground">{f.summary}</p>
            {f.key_facts.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                {f.key_facts.map((k, j) => (
                  <li key={j}>{k}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-primary">→ {f.implications_for_deliverable}</p>
          </div>
        ))}
      </div>
      {research.open_questions.length > 0 && (
        <div className="editorial-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Open questions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {research.open_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OutlineTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: { outline: OutlineSection[] | null };
  onUpdate: () => void;
}) {
  const generate = useServerFn(generateOutline);
  const update = useServerFn(updateOutline);
  const [generating, setGenerating] = useState(false);
  const [outline, setOutline] = useState<OutlineSection[]>(project.outline ?? []);

  useEffect(() => {
    setOutline(project.outline ?? []);
  }, [project.outline]);

  async function gen() {
    setGenerating(true);
    try {
      const o = await generate({ data: { project_id: projectId } });
      setOutline(o);
      onUpdate();
      toast.success("Outline generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function save(next: OutlineSection[]) {
    setOutline(next);
    await update({ data: { project_id: projectId, outline: next } });
  }

  if (outline.length === 0) {
    return (
      <div className="editorial-card p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-serif text-xl text-foreground">No outline yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate a section breakdown matched to the deliverable type.
        </p>
        <Button onClick={gen} disabled={generating} className="mt-5">
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Generate outline
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {outline.map((s, idx) => (
        <div key={s.id} className="editorial-card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-2 text-xs text-muted-foreground tabular-nums">{idx + 1}.</span>
            <div className="flex-1 space-y-2">
              <Input
                value={s.title}
                onChange={(e) => {
                  const next = [...outline];
                  next[idx] = { ...s, title: e.target.value };
                  setOutline(next);
                }}
                onBlur={() => save(outline)}
                className="text-base font-medium"
              />
              <Textarea
                rows={2}
                value={s.prompt}
                onChange={(e) => {
                  const next = [...outline];
                  next[idx] = { ...s, prompt: e.target.value };
                  setOutline(next);
                }}
                onBlur={() => save(outline)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {s.content ? "Drafted ✓" : "Empty"}
              </p>
            </div>
          </div>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={gen} disabled={generating}>
          Regenerate from scratch
        </Button>
      </div>
    </div>
  );
}

function DraftingTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: { outline: OutlineSection[] | null };
  onUpdate: () => void;
}) {
  const draft = useServerFn(draftSection);
  const update = useServerFn(updateOutline);
  const [outline, setOutline] = useState<OutlineSection[]>(project.outline ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    setOutline(project.outline ?? []);
  }, [project.outline]);

  if (outline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No outline yet. Head to the Outline tab and generate one first.
      </p>
    );
  }

  async function runAction(
    id: string,
    action: "draft" | "expand" | "tighten" | "rewrite_with_feedback",
    feedback?: string,
  ) {
    setActiveId(id);
    try {
      const { content } = await draft({
        data: { project_id: projectId, section_id: id, action, feedback },
      });
      const next = outline.map((s) => (s.id === id ? { ...s, content } : s));
      setOutline(next);
      onUpdate();
      toast.success(`${action.replace(/_/g, " ")} done`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActiveId(null);
      setFeedbackTarget(null);
      setFeedbackText("");
    }
  }

  async function applyFeedback() {
    if (!feedbackTarget || feedbackText.trim().length < 5) {
      toast.error("Type some feedback first.");
      return;
    }
    await runAction(feedbackTarget, "rewrite_with_feedback", feedbackText.trim());
  }

  async function manualEdit(id: string, content: string) {
    const next = outline.map((s) => (s.id === id ? { ...s, content } : s));
    setOutline(next);
    await update({ data: { project_id: projectId, outline: next } });
  }

  return (
    <div className="space-y-6">
      <Dialog open={feedbackTarget != null} onOpenChange={(o) => !o && setFeedbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply interviewer feedback</DialogTitle>
            <DialogDescription>
              Paste the specific feedback you got. AI will rewrite this section, preserving the rest.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="e.g. 'Less abstract — give me 3 specific accounts you'd target in Q1 with named decision makers.'"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeedbackTarget(null)}>
              Cancel
            </Button>
            <Button onClick={applyFeedback} disabled={feedbackText.trim().length < 5}>
              Rewrite section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {outline.map((s) => {
        const busy = activeId === s.id;
        return (
          <div key={s.id} className="editorial-card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-xl text-foreground">{s.title}</h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runAction(s.id, "draft")}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  <span className="ml-1">AI draft</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runAction(s.id, "expand")}
                  disabled={busy || !s.content}
                >
                  <Maximize2 className="h-3 w-3" />
                  <span className="ml-1">Expand</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => runAction(s.id, "tighten")}
                  disabled={busy || !s.content}
                >
                  <Minimize2 className="h-3 w-3" />
                  <span className="ml-1">Tighten</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFeedbackTarget(s.id);
                    setFeedbackText("");
                  }}
                  disabled={busy || !s.content}
                >
                  <MessagesSquare className="h-3 w-3" />
                  <span className="ml-1">Feedback</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{s.prompt}</p>
            <Textarea
              value={s.content}
              onChange={(e) => {
                const next = outline.map((x) => (x.id === s.id ? { ...x, content: e.target.value } : x));
                setOutline(next);
              }}
              onBlur={() => manualEdit(s.id, s.content)}
              rows={Math.max(6, Math.min(20, s.content.split("\n").length + 2))}
              placeholder="Use AI draft, or write directly. Markdown supported."
              className="font-mono text-sm"
            />
            {s.content && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground">Preview rendered</summary>
                <div className="prose prose-invert prose-zinc mt-3 max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExportMenu({
  projectId,
  project,
}: {
  projectId: string;
  project: { title: string; outline: OutlineSection[] | null };
}) {
  const exp = useServerFn(exportProject);
  const [busy, setBusy] = useState(false);

  async function go(fmt: "pptx" | "docx" | "html") {
    if (!project.outline || project.outline.length === 0) {
      toast.error("Draft some sections first.");
      return;
    }
    setBusy(true);
    try {
      // Record artifact server-side (also bumps last_exported_at)
      await exp({ data: { project_id: projectId, format: fmt } });

      // Generate the file client-side
      const safeTitle = project.title.replace(/[^a-z0-9-_ ]/gi, "_");
      const sections = project.outline;
      if (fmt === "pptx") {
        const { default: PPTX } = await import("pptxgenjs");
        const pptx = new PPTX();
        pptx.layout = "LAYOUT_WIDE";
        // Cover slide
        const cover = pptx.addSlide();
        cover.background = { color: "0F0F12" };
        cover.addText(project.title, {
          x: 0.5,
          y: 1.5,
          w: "90%" as unknown as number,
          h: 1.5,
          fontSize: 44,
          color: "F5F5F4",
          fontFace: "Inter",
          bold: true,
        });
        cover.addText(new Date().toLocaleDateString(), {
          x: 0.5,
          y: 3.2,
          w: "90%" as unknown as number,
          h: 0.4,
          fontSize: 14,
          color: "A3A3A3",
        });
        for (const s of sections) {
          const slide = pptx.addSlide();
          slide.background = { color: "0F0F12" };
          slide.addText(s.title, {
            x: 0.5,
            y: 0.4,
            w: "90%" as unknown as number,
            h: 0.8,
            fontSize: 28,
            color: "F5F5F4",
            fontFace: "Inter",
            bold: true,
          });
          slide.addText(s.content || "(empty)", {
            x: 0.5,
            y: 1.3,
            w: "90%" as unknown as number,
            h: 5.5,
            fontSize: 14,
            color: "D4D4D4",
            fontFace: "Inter",
            valign: "top",
          });
        }
        await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
      } else if (fmt === "docx") {
        const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
        const children = [
          new Paragraph({
            children: [new TextRun({ text: project.title, bold: true, size: 48 })],
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),
        ];
        for (const s of sections) {
          children.push(
            new Paragraph({
              text: s.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
          );
          for (const line of (s.content || "").split("\n")) {
            children.push(new Paragraph({ text: line, spacing: { after: 120 } }));
          }
        }
        const doc = new Document({ sections: [{ properties: {}, children }] });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeTitle}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // html — generate a printable HTML doc
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${project.title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 60px auto; padding: 0 24px; line-height: 1.6; color: #1c1917; }
  h1 { font-size: 36px; margin-bottom: 8px; }
  h2 { font-size: 24px; margin-top: 48px; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style></head><body>
<h1>${project.title}</h1>
${sections
  .map(
    (s) =>
      `<h2>${escapeHtml(s.title)}</h2><pre>${escapeHtml(s.content || "(empty)")}</pre>`,
  )
  .join("")}
<p style="margin-top:60px;color:#78716c;font-size:12px">Generated ${new Date().toLocaleString()}</p>
</body></html>`;
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeTitle}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${fmt.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => go("pptx")}>PowerPoint (.pptx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("docx")}>Word (.docx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => go("html")}>HTML / Print to PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
