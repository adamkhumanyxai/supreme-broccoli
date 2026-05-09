import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway";

export const DOSSIER_SECTIONS = [
  { key: "snapshot", title: "Snapshot", icon: "Sparkles" },
  { key: "business_model", title: "Business Model", icon: "Banknote" },
  { key: "financials_trajectory", title: "Financials & Trajectory", icon: "BarChart3" },
  { key: "culture_values", title: "Culture & Values", icon: "Users" },
  { key: "leadership", title: "Leadership", icon: "Crown" },
  { key: "recent_moves", title: "Recent Moves", icon: "Newspaper" },
  { key: "competitive_landscape", title: "Competitive Landscape", icon: "Swords" },
  { key: "domain_context", title: "Domain Context", icon: "Compass" },
  { key: "likely_themes", title: "Likely Interview Themes", icon: "Target" },
  { key: "smart_questions", title: "Smart Questions to Ask", icon: "MessageCircleQuestion" },
] as const;

const DossierSchema = z.object({
  snapshot: z.string(),
  business_model: z.string(),
  financials_trajectory: z.string(),
  culture_values: z.string(),
  leadership: z.string(),
  recent_moves: z.string(),
  competitive_landscape: z.string(),
  domain_context: z.string(),
  likely_themes: z.string(),
  smart_questions: z.string(),
});

export type Dossier = z.infer<typeof DossierSchema>;

const MODEL_ID = DEFAULT_MODEL;

function bullets(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "(none provided)";
  return arr.map((s) => `- ${s}`).join("\n");
}

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string }) =>
    z.object({ job_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", data.job_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Job not found");

    const { data: company } = job.company_id
      ? await supabase.from("companies").select("*").eq("id", job.company_id).maybeSingle()
      : { data: null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: prevMax } = await supabase
      .from("insights")
      .select("version")
      .eq("job_id", job.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (prevMax?.version ?? 0) + 1;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_ID);

    const reqs = bullets((job as { requirements?: string[] }).requirements);
    const resps = bullets((job as { responsibilities?: string[] }).responsibilities);

    const system = `You are a senior career coach producing a strategic intelligence dossier on a specific company for a specific candidate. Your job is to give them an unfair advantage in an interview.

Draw on what you know about the company, its market, and the role. Cite specific facts (numbers, dates, names) when you're confident — be explicit about uncertainty otherwise ("publicly available info is limited on X"). Recent Moves should reference recent events you have knowledge of, even if you can't pin exact dates.

CANDIDATE
Name: ${profile?.full_name ?? "(not provided)"}
Headline: ${profile?.headline ?? "(not provided)"}
Domain: ${profile?.domain ?? "(not provided)"}
Years experience: ${profile?.years_experience ?? "(not provided)"}
Superpowers: ${profile?.superpowers ?? "(not provided)"}

JOB
Company: ${company?.name ?? "(unknown)"}
Website: ${company?.website ?? "(unknown)"}
Role: ${job.title}
Description: ${job.description ?? "(none provided)"}
Requirements:
${reqs}
Responsibilities:
${resps}

Be specific, not generic. The "likely_themes" section MUST reference the specific stated requirements above. Each output field is clean GitHub-flavored Markdown (use bullet lists, bold sparingly, no top-level headings — section titles are rendered separately). Tailor "domain_context" to the candidate's domain (${profile?.domain ?? "unspecified"}).`;

    let dossier: Dossier | null = null;
    let errorMsg: string | null = null;
    try {
      const { experimental_output } = await generateText({
        model,
        experimental_output: Output.object({ schema: DossierSchema }),
        system,
        prompt:
          "Produce the dossier now. Each field should be 4-12 sentences (or a strong bulleted list) of substantive, specific content.",
      });
      dossier = experimental_output;
    } catch (e) {
      console.error("Dossier generation failed", e);
      errorMsg = e instanceof Error ? e.message : "Generation failed";
    }

    await supabase
      .from("insights")
      .update({ is_current: false })
      .eq("job_id", job.id)
      .eq("is_current", true);

    const { data: inserted, error: insErr } = await supabase
      .from("insights")
      .insert({
        user_id: userId,
        job_id: job.id,
        version: nextVersion,
        model: MODEL_ID,
        is_current: true,
        status: errorMsg ? "error" : "ready",
        generated_at: new Date().toISOString(),
        dossier: (dossier as unknown) as never,
        error: errorMsg,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (!errorMsg) {
      await supabase
        .from("analytics_events")
        .insert({
          user_id: userId,
          event_name: "dossier_generated",
          properties: { job_id: job.id, version: nextVersion } as unknown as never,
        })
        .then(
          () => undefined,
          () => undefined,
        );
    }

    return inserted;
  });
