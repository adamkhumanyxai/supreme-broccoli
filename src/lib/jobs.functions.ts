import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, FAST_MODEL, extractJsonText } from "@/lib/ai-gateway";

const URL_RE = /^https?:\/\/\S+$/i;

function stripHtml(html: string): string {
  // Pre-strip noisy blocks before main extraction
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 30000);
}

const ParsedJobSchema = z.object({
  company_name: z.string().nullable(),
  company_website: z.string().nullable(),
  role_title: z.string().nullable(),
  description: z.string().nullable(),
  requirements: z.array(z.string()),
  responsibilities: z.array(z.string()),
  location: z.string().nullable(),
  comp_band: z.string().nullable(),
  source_url: z.string().nullable(),
});

export type ParsedJob = z.infer<typeof ParsedJobSchema>;

export const extractJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { input: string }) =>
    z.object({ input: z.string().min(10).max(50000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const isUrl = URL_RE.test(data.input.trim());
    let text = data.input;
    let sourceUrl: string | null = null;
    if (isUrl) {
      sourceUrl = data.input.trim();
      try {
        const res = await fetch(sourceUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; InterviewPrepBot/1.0; +https://lovable.dev)",
            Accept: "text/html,application/xhtml+xml",
          },
        });
        const html = await res.text();
        text = stripHtml(html);
        if (text.length < 500) {
          throw new Error(
            `This page looks JS-rendered (we got ${text.length} chars of content). Please paste the job description text directly instead.`,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("This page looks JS-rendered")) {
          throw e;
        }
        console.error("URL fetch failed", e);
        text = data.input;
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log("[extractJob] apiKey present:", !!apiKey, "len:", apiKey?.length, "model:", FAST_MODEL);
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(FAST_MODEL);

    const jsonShape = `{"company_name":"string|null","company_website":"string|null","role_title":"string|null","description":"string|null","requirements":["string"],"responsibilities":["string"],"location":"string|null","comp_band":"string|null","source_url":"string|null"}`;

    const jobContent = text;
    let rawText: string;
    try {
      const aiResult = await generateText({
        model,
        system:
          `You are a job description parser. Extract clean structured data. If a field can't be determined, return null. Clean boilerplate from descriptions. Return arrays even if empty.\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure:\n${jsonShape}`,
        prompt: `Parse this job posting. ${sourceUrl ? `Source URL: ${sourceUrl}\n\n` : ""}Content:\n\n${jobContent}`,
      });
      rawText = aiResult.text;
    } catch (e) {
      console.error("[extractJob] generateText threw:", e);
      throw e;
    }

    console.log("[extractJob] raw response (first 300):", rawText.slice(0, 300));
    const parsed = ParsedJobSchema.parse(JSON.parse(extractJsonText(rawText)));
    console.log("[extractJob] parsed ok, company:", parsed.company_name, "role:", parsed.role_title);

    return { parsed: { ...parsed, source_url: parsed.source_url ?? sourceUrl } };
  });

export const createJobFromParsed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { parsed: ParsedJob; sourceInput: string }) =>
    z
      .object({
        parsed: ParsedJobSchema,
        sourceInput: z.string().min(1).max(50000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyName = data.parsed.company_name?.trim() || "Unknown company";

    // Look up existing company by name for this user
    const { data: existing } = await supabase
      .from("companies")
      .select("id, website")
      .eq("name", companyName)
      .maybeSingle();

    let companyId: string;
    if (existing) {
      companyId = existing.id;
      if (data.parsed.company_website && !existing.website) {
        await supabase
          .from("companies")
          .update({ website: data.parsed.company_website })
          .eq("id", companyId);
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("companies")
        .insert({
          user_id: userId,
          name: companyName,
          website: data.parsed.company_website,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Failed to create company: ${error.message}`);
      companyId = inserted.id;
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        company_id: companyId,
        title: data.parsed.role_title?.trim() || "Untitled role",
        description: data.parsed.description,
        requirements: data.parsed.requirements ?? [],
        responsibilities: data.parsed.responsibilities ?? [],
        source_url: data.parsed.source_url,
        source_input: data.sourceInput,
        extracted_at: new Date().toISOString(),
        status: "prospecting",
      })
      .select("id")
      .single();
    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    // Track funnel
    await supabase
      .from("analytics_events")
      .insert({
        user_id: userId,
        event_name: "job_added",
        properties: { job_id: job.id } as unknown as never,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return { job_id: job.id, company_id: companyId };
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("jobs")
      .select("id, title, status, updated_at, created_at, company_id, source_url")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const companyIds = Array.from(new Set((data || []).map((j) => j.company_id).filter(Boolean))) as string[];
    const companies =
      companyIds.length === 0
        ? []
        : (
            await supabase
              .from("companies")
              .select("id, name, logo_url, hq_location")
              .in("id", companyIds)
          ).data || [];
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    const jobIds = (data || []).map((j) => j.id);
    const insights =
      jobIds.length === 0
        ? []
        : (
            await supabase
              .from("insights")
              .select("job_id, version, generated_at, error")
              .in("job_id", jobIds)
              .eq("is_current", true)
          ).data || [];
    const insightMap = new Map(insights.map((i) => [i.job_id, i]));

    return (data || []).map((j) => ({
      ...j,
      company: j.company_id ? companyMap.get(j.company_id) ?? null : null,
      current_insight: insightMap.get(j.id) ?? null,
    }));
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string }) =>
    z.object({ job_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", data.job_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");

    const { data: company } = job.company_id
      ? await supabase.from("companies").select("*").eq("id", job.company_id).maybeSingle()
      : { data: null };

    const { data: insight } = await supabase
      .from("insights")
      .select("*")
      .eq("job_id", job.id)
      .eq("is_current", true)
      .maybeSingle();

    return { job, company, insight };
  });

export const updateJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string; status: string }) =>
    z
      .object({
        job_id: z.string().uuid(),
        status: z.enum(["prospecting", "interviewing", "offer", "closed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("jobs")
      .update({ status: data.status as "prospecting" })
      .eq("id", data.job_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInsightHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string }) =>
    z.object({ job_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("insights")
      .select("id, version, model, generated_at, is_current, error, dossier")
      .eq("job_id", data.job_id)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows || [];
  });
