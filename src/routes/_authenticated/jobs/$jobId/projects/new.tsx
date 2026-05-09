import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { extractProjectBrief } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/projects/new")({
  component: NewProject,
});

const PLACEHOLDER = `Paste the take-home brief.

For example:
"Build a 30/60/90 plan for our new sales region launch in EMEA…"
"Design a system for handling 100k concurrent connections…"
"Walk us through how you'd evaluate Vendor X vs Vendor Y…"

We'll extract the deliverable type and key requirements automatically.`;

function NewProject() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const extract = useServerFn(extractProjectBrief);
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (brief.trim().length < 20) {
      toast.error("Paste a more detailed brief.");
      return;
    }
    setSubmitting(true);
    try {
      const { project_id } = await extract({
        data: { job_id: jobId, raw_brief: brief.trim() },
      });
      navigate({ to: "/projects/$projectId", params: { projectId: project_id } });
    } catch (e) {
      toast.error((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-3xl text-foreground">New project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a take-home assignment. We'll extract the requirements and structure a workspace.
        </p>
      </div>

      <Textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={14}
        placeholder={PLACEHOLDER}
        className="font-mono text-sm"
        disabled={submitting}
      />

      <div className="flex justify-end">
        <Button size="lg" onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…
            </>
          ) : (
            <>
              Parse brief <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
