import { useState } from "react";
import type { FullProfile } from "@/routes/_authenticated/profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { extractPdfText } from "@/lib/pdf";
import { toast } from "sonner";
import { ChevronDown, FileText, Upload } from "lucide-react";

type Props = {
  userId: string;
  profile: FullProfile | null;
  onChange: (patch: Partial<FullProfile>) => void;
};

const MAX_BYTES = 10 * 1024 * 1024;

export function ResumeCard({ userId, profile, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("PDF only.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Max 10MB.");
      return;
    }
    setUploading(true);
    try {
      const path = `${userId}/resume.pdf`;
      const { error: upErr } = await supabase.storage
        .from("user-files")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const text = await extractPdfText(file);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ resume_file_url: path, resume_text: text })
        .eq("user_id", userId);
      if (dbErr) throw dbErr;

      onChange({ resume_file_url: path, resume_text: text });
      toast.success("Resume uploaded");
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const hasResume = !!profile?.resume_file_url;

  return (
    <section className="editorial-card p-6 md:p-8">
      <h3 className="font-serif text-xl text-foreground">Resume</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a PDF. We extract the text so the AI can reference it.
      </p>

      <div className="mt-6">
        {hasResume ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-3 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-foreground">resume.pdf</span>
              <span className="text-muted-foreground">
                ·{" "}
                {profile?.resume_text
                  ? `${profile.resume_text.length.toLocaleString()} chars extracted`
                  : "no text"}
              </span>
            </div>
            <label>
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={onFile}
                disabled={uploading}
              />
              <Button asChild variant="outline" disabled={uploading}>
                <span>{uploading ? "Uploading…" : "Replace"}</span>
              </Button>
            </label>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/20 px-6 py-10 text-center transition-colors hover:border-border-strong">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {uploading ? "Uploading…" : "Click to upload your resume (PDF, ≤10MB)"}
            </span>
            <input
              type="file"
              accept="application/pdf"
              hidden
              onChange={onFile}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {profile?.resume_text && (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-5">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            View extracted text
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans">
              {profile.resume_text}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
