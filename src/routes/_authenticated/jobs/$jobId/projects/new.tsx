import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { extractProjectBrief } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/projects/new")({
  component: NewProject,
});

const BRIEF_PLACEHOLDER = `Paste the take-home brief.

For example:
"Build a 30/60/90 plan for our new sales region launch in EMEA…"
"Design a system for handling 100k concurrent connections…"
"Walk us through how you'd evaluate Vendor X vs Vendor Y…"

We'll extract the deliverable type and key requirements automatically.`;

const REQUEST_PLACEHOLDER = `Optional — describe your personal angle or what you want to explore.

For example:
"I want to leverage Challenger Sales methodology throughout — position us as challenging the status quo."
"Angle everything through my fintech background, draw parallels where possible."
"I want this to demonstrate strategic thinking over execution detail."`;

function NewProject() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const extract = useServerFn(extractProjectBrief);
  const [brief, setBrief] = useState("");
  const [personalRequest, setPersonalRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (brief.trim().length < 20) {
      toast.error("Paste a more detailed brief.");
      return;
    }
    setSubmitting(true);
    try {
      const { project_id } = await extract({
        data: {
          job_id: jobId,
          raw_brief: brief.trim(),
          personal_request: personalRequest.trim() || undefined,
        },
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

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Assignment brief</p>
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={14}
          placeholder={BRIEF_PLACEHOLDER}
          className="font-mono text-sm"
          disabled={submitting}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Your angle <span className="normal-case text-muted-foreground/60">(optional)</span>
          </p>
        </div>
        <Textarea
          value={personalRequest}
          onChange={(e) => setPersonalRequest(e.target.value)}
          rows={4}
          placeholder={REQUEST_PLACEHOLDER}
          className="text-sm"
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">
          This gets threaded through research, outline, and every drafted section — shaping the AI's lens without replacing the brief.
        </p>
      </div>

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
