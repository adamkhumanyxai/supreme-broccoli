import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { extractJob, createJobFromParsed, type ParsedJob } from "@/lib/jobs.functions";
import { generateInsights } from "@/lib/insights.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Loader2, AlertTriangle, Sparkles, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  component: NewJob,
});

const PLACEHOLDER = `Paste a job URL like https://jobs.lever.co/...
or paste the full job description text.`;

function NewJob() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const extract = useServerFn(extractJob);
  const create = useServerFn(createJobFromParsed);
  const generate = useServerFn(generateInsights);

  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [domainMissing, setDomainMissing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("domain")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setDomainMissing(!data?.domain));
  }, [user]);

  async function onParse() {
    if (input.trim().length < 10) {
      toast.error("Paste a URL or job description first.");
      return;
    }
    setParsing(true);
    try {
      const { parsed } = await extract({ data: { input: input.trim() } });
      setParsed(parsed);
    } catch (e) {
      toast.error((e as Error).message || "Failed to parse");
    } finally {
      setParsing(false);
    }
  }

  async function onSave() {
    if (!parsed) return;
    setSaving(true);
    try {
      const { job_id } = await create({ data: { parsed, sourceInput: input.trim() } });
      // kick off generation in background — don't await
      generate({ data: { job_id } }).catch((e) => console.error("generate failed", e));
      toast.success("Job saved. Generating dossier…");
      navigate({ to: "/jobs/$jobId", params: { jobId: job_id } });
    } catch (e) {
      toast.error((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Jobs</p>
        <h2 className="mt-1 font-serif text-3xl text-foreground">Add a new role</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a job posting URL or the full description. We'll extract the details and kick off a tailored company dossier.
        </p>
      </div>

      {domainMissing && (
        <div className="editorial-card flex items-start gap-3 border-amber-900/40 bg-amber-950/20 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="text-foreground">Set your domain to get a dossier tailored to your specialty.</p>
            <Link to="/profile" className="text-primary underline-offset-4 hover:underline">
              Update profile
            </Link>
          </div>
        </div>
      )}

      {!parsed && (
        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder={PLACEHOLDER}
            className="font-mono text-sm"
            disabled={parsing}
          />
          <div className="flex justify-end">
            <Button onClick={onParse} disabled={parsing} size="lg">
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…
                </>
              ) : (
                <>
                  Parse <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {parsed && (
        <ParsedConfirm
          parsed={parsed}
          onChange={setParsed}
          onCancel={() => setParsed(null)}
          onSave={onSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function ParsedConfirm({
  parsed,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  parsed: ParsedJob;
  onChange: (p: ParsedJob) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  function patch<K extends keyof ParsedJob>(k: K, v: ParsedJob[K]) {
    onChange({ ...parsed, [k]: v });
  }

  return (
    <div className="editorial-card space-y-5 p-6">
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <Sparkles className="h-4 w-4" /> Extracted — review and edit before saving
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company">
          <Input value={parsed.company_name ?? ""} onChange={(e) => patch("company_name", e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={parsed.company_website ?? ""} onChange={(e) => patch("company_website", e.target.value)} />
        </Field>
        <Field label="Role title">
          <Input value={parsed.role_title ?? ""} onChange={(e) => patch("role_title", e.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={parsed.location ?? ""} onChange={(e) => patch("location", e.target.value)} />
        </Field>
        <Field label="Compensation">
          <Input value={parsed.comp_band ?? ""} onChange={(e) => patch("comp_band", e.target.value)} />
        </Field>
        <Field label="Source URL">
          <Input value={parsed.source_url ?? ""} onChange={(e) => patch("source_url", e.target.value)} />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          rows={6}
          value={parsed.description ?? ""}
          onChange={(e) => patch("description", e.target.value)}
        />
      </Field>

      <ListEditor
        label="Requirements"
        items={parsed.requirements}
        onChange={(items) => patch("requirements", items)}
      />
      <ListEditor
        label="Responsibilities"
        items={parsed.responsibilities}
        onChange={(items) => patch("responsibilities", items)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Start over
        </Button>
        <Button onClick={onSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>Save & generate dossier</>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={it}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-2 h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}
