import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL, extractJsonText } from "@/lib/ai-gateway";

// Structured employer sentiment — replaces the old flat "Culture & Values" string.
// Generated via a separate web-search-enabled call (Perplexity sonar) so it reflects
// real employee review data from Glassdoor, Blind, Levels.fyi, etc.
export const EmployerBrandSchema = z.object({
  score: z.number().min(0).max(10),
  score_rationale: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  compensation_verdict: z.string(),
  equity: z.string(),
  perks: z.array(z.string()),
  remote_policy: z.string(),
  red_flags: z.array(z.string()),
  verdict: z.string(),
});

export type EmployerBrand = z.infer<typeof EmployerBrandSchema>;

export const DOSSIER_SECTIONS = [
  { key: "snapshot", title: "Snapshot", icon: "Sparkles" },
  { key: "business_model", title: "Business Model", icon: "Banknote" },
  { key: "financials_trajectory", title: "Financials & Trajectory", icon: "BarChart3" },
  { key: "employer_brand", title: "Employer Score", icon: "Star" },
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
  employer_brand: EmployerBrandSchema.optional(), // structured card; absent on legacy dossiers
  culture_values: z.string().optional(),           // legacy field; kept for history page compat
  leadership: z.string(),
  recent_moves: z.string(),
  competitive_landscape: z.string(),
  domain_context: z.string(),
  likely_themes: z.string(),
  smart_questions: z.string(),
});

export type Dossier = z.infer<typeof DossierSchema>;

const MODEL_ID = DEFAULT_MODEL;
// Perplexity sonar has live web search — it can actually pull current Glassdoor/Blind/
// Levels.fyi data. Configurable so users without Perplexity credits can swap it out.
const EMPLOYER_BRAND_MODEL = process.env.EMPLOYER_BRAND_MODEL ?? "perplexity/sonar";

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

    const reqs = bullets((job as { requirements?: string[] }).requirements);
    const resps = bullets((job as { responsibilities?: string[] }).responsibilities);

    const candidateCtx = `CANDIDATE
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
${resps}`;

    // ── Call 1: Main 9-section dossier (GPT-4o or configured model) ─────────────
    const mainSystem = `You are a senior career coach producing a strategic intelligence dossier on a specific company for a specific candidate. Your job is to give them an unfair advantage in an interview.

Draw on what you know about the company, its market, and the role. Cite specific facts (numbers, dates, names) when you're confident — be explicit about uncertainty otherwise ("publicly available info is limited on X"). Recent Moves should reference recent events you have knowledge of, even if you can't pin exact dates.

${candidateCtx}

Be specific, not generic. The "likely_themes" section MUST reference the specific stated requirements above. Each output field is clean GitHub-flavored Markdown (use bullet lists, bold sparingly, no top-level headings — section titles are rendered separately). Tailor "domain_context" to the candidate's domain (${profile?.domain ?? "unspecified"}).`;

    const mainJsonShape = `{"snapshot":"string","business_model":"string","financials_trajectory":"string","leadership":"string","recent_moves":"string","competitive_landscape":"string","domain_context":"string","likely_themes":"string","smart_questions":"string"}`;

    // ── Call 2: Employer brand research (Perplexity sonar — live web search) ─────
    const employerBrandPrompt = `Research ${company?.name ?? "this company"} as an employer. Search for employee reviews on Glassdoor, Blind, Indeed, LinkedIn, Levels.fyi, and any other available sources. This is for a candidate considering a ${job.title} role${company?.hq_location ? ` based in ${company.hq_location}` : ""}.

Synthesise the real employee sentiment you find. Be honest and specific — the candidate needs this to decide whether to pursue and whether to accept. Score on a 0–10 scale anchored on actual employee sentiment data.

Return ONLY valid JSON matching this exact structure:
{"score":<float 0-10>,"score_rationale":"<1-2 sentences on what drives the score>","pros":["<top 3-4 things employees genuinely love>"],"cons":["<top 2-3 real complaints>"],"compensation_verdict":"<how pay compares to market, specific numbers/percentiles if available>","equity":"<stock/RSU/options situation — vesting, refresh, size>","perks":["<notable benefits that actually matter>"],"remote_policy":"<remote/hybrid/in-office — be specific about days/flexibility>","red_flags":["<honest concerns a candidate should know; empty array if none>"],"verdict":"<2-3 sentences, candidate-perspective: is this a good place to work for someone in this role and at this stage?>"}`;

    const [mainResult, employerBrandResult] = await Promise.allSettled([
      generateText({
        model: gateway(MODEL_ID),
        system: `${mainSystem}\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure:\n${mainJsonShape}`,
        prompt: "Produce the dossier now. Each field should be 4-12 sentences (or a strong bulleted list) of substantive, specific content.",
      }),
      generateText({
        model: gateway(EMPLOYER_BRAND_MODEL),
        prompt: employerBrandPrompt,
      }),
    ]);

    // Parse main dossier
    const MainDossierSchema = DossierSchema.omit({ employer_brand: true, culture_values: true });
    let dossier: Dossier | null = null;
    let errorMsg: string | null = null;
    try {
      if (mainResult.status === "rejected") throw mainResult.reason;
      const parsed = MainDossierSchema.parse(JSON.parse(extractJsonText(mainResult.value.text)));
      dossier = parsed as Dossier;
    } catch (e) {
      console.error("Main dossier generation failed", e);
      errorMsg = e instanceof Error ? e.message : "Generation failed";
    }

    // Parse employer brand (non-fatal if it fails)
    let employerBrand: EmployerBrand | null = null;
    try {
      if (employerBrandResult.status === "rejected") throw employerBrandResult.reason;
      employerBrand = EmployerBrandSchema.parse(
        JSON.parse(extractJsonText(employerBrandResult.value.text)),
      );
    } catch (e) {
      console.warn("Employer brand generation failed (non-fatal):", (e as Error).message);
    }

    if (dossier && employerBrand) {
      dossier = { ...dossier, employer_brand: employerBrand };
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
