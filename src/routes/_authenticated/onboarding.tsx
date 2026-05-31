import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { updateUserSettings, trackEvent } from "@/lib/settings.functions";
import { extractPdfText } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOMAIN_OPTIONS } from "@/lib/profile";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const updateSettings = useServerFn(updateUserSettings);

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [domain, setDomain] = useState("");
  const [superpowers, setSuperpowers] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill from existing profile if any
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, headline, domain, superpowers")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setFullName(data.full_name ?? "");
        setHeadline(data.headline ?? "");
        setDomain(data.domain ?? "");
        setSuperpowers(data.superpowers ?? "");
      });
  }, [user]);

  async function next() {
    if (!user) return;
    setSaving(true);
    try {
      if (step === 2) {
        // save About You
        await supabase
          .from("profiles")
          .update({ full_name: fullName, headline, domain: domain || null })
          .eq("user_id", user.id);
        setStep(3);
      } else if (step === 3) {
        // save resume if uploaded — also extract text client-side
        if (resumeFile) {
          const path = `${user.id}/resume.pdf`;
          await supabase.storage.from("user-files").upload(path, resumeFile, {
            upsert: true,
            contentType: "application/pdf",
          });
          let resumeText: string | null = null;
          try {
            resumeText = await extractPdfText(resumeFile);
          } catch (e) {
            console.warn("PDF extraction failed; storing file without text", e);
          }
          await supabase
            .from("profiles")
            .update({
              resume_file_url: path,
              ...(resumeText ? { resume_text: resumeText } : {}),
            })
            .eq("user_id", user.id);
        }
        setStep(4);
      } else if (step === 4) {
        // save superpowers, mark complete, track signup completion
        await supabase.from("profiles").update({ superpowers }).eq("user_id", user.id);
        await updateSettings({ data: { onboarding_completed: true } });
        trackEvent({ data: { event_name: "profile_completed" } }).catch(() => undefined);
        toast.success("All set. Let's get you prepped.");
        navigate({ to: "/dashboard" });
      } else {
        setStep((s) => s + 1);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function skipAll() {
    if (!user) return;
    await updateSettings({ data: { onboarding_completed: true } });
    navigate({ to: "/dashboard" });
  }

  const canProceed =
    (step === 1) ||
    (step === 2 && fullName.trim().length > 0 && headline.trim().length > 0 && domain.length > 0) ||
    (step === 3) ||
    (step === 4);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1.5 w-12 rounded-full transition-colors ${
              n <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl text-foreground">Welcome to Interview Compass.</h2>
          <p className="text-muted-foreground">
            Three things together: <strong className="text-foreground">company intel</strong> on
            roles you're chasing, <strong className="text-foreground">mock interviews</strong> with
            voice or text, and <strong className="text-foreground">a take-home builder</strong> for
            project assignments.
          </p>
          <p className="text-muted-foreground">
            Spend two minutes telling us about you so the AI can personalize. Or skip and figure it
            out as you go.
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl text-foreground">About you</h2>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Senior Software Engineer, 10+ yrs distributed systems"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick your domain…" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl text-foreground">Your resume</h2>
          <p className="text-sm text-muted-foreground">
            Upload your CV as a PDF. We extract the text so the AI can reference your background
            during mocks and dossiers. Optional — you can do this later.
          </p>
          <Input
            type="file"
            accept="application/pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
          />
          {resumeFile && (
            <p className="text-xs text-muted-foreground">Selected: {resumeFile.name}</p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl text-foreground">Your superpowers</h2>
          <p className="text-sm text-muted-foreground">
            What's your unfair advantage? Domain expertise, signature accomplishments, technical
            depth, network — anything that sets you apart. Bullets or prose, doesn't matter.
          </p>
          <Textarea
            rows={6}
            value={superpowers}
            onChange={(e) => setSuperpowers(e.target.value)}
            placeholder="• 20+ yrs voice/CPaaS sales at Twilio
• Closed largest deal in ANZ region 2024
• Deep relationships across SI partner channel
…"
          />
        </section>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={skipAll}>
          Skip for now
        </Button>
        <Button onClick={next} disabled={!canProceed || saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {step === 4 ? "Finish" : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
