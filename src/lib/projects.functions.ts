import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createLovableAiGatewayProvider,
  DEFAULT_MODEL,
  FAST_MODEL,
  extractJsonText,
} from "@/lib/ai-gateway";

export const DELIVERABLE_TYPES = [
  "30_60_90",
  "tech_design_doc",
  "product_strategy",
  "gtm_plan",
  "case_study",
  "sales_pitch",
  "eng_take_home",
  "custom",
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
  "30_60_90": "30/60/90-Day Plan",
  tech_design_doc: "Technical Design Doc",
  product_strategy: "Product Strategy Memo",
  gtm_plan: "GTM Plan",
  case_study: "Case Study Response",
  sales_pitch: "Sales Pitch",
  eng_take_home: "Engineering Take-Home",
  custom: "Custom",
};

const ExtractedBriefSchema = z.object({
  deliverable_type: z.enum(DELIVERABLE_TYPES),
  requirements: z.array(z.string()),
  deadline: z.string().nullable(),
  audience: z.string().nullable(),
  format: z.string().nullable(),
  key_questions: z.array(z.string()),
});
export type ExtractedBrief = z.infer<typeof ExtractedBriefSchema>;

const ResearchFindingSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  key_facts: z.array(z.string()),
  implications_for_deliverable: z.string(),
});
const ResearchSchema = z.object({
  findings: z.array(ResearchFindingSchema),
  open_questions: z.array(z.string()),
});
export type ResearchNotes = z.infer<typeof ResearchSchema>;

export type OutlineSection = {
  id: string;
  title: string;
  prompt: string;
  content: string; // markdown
};

const MODEL_PRO = DEFAULT_MODEL;
const MODEL_FLASH = FAST_MODEL;

const TEMPLATES: Record<DeliverableType, { title: string; prompt: string }[]> = {
  "30_60_90": [
    {
      title: "First 30 Days · Learn",
      prompt: "What you'll listen, learn, and align on. Specific to this role + company.",
    },
    {
      title: "Days 31–60 · Own",
      prompt: "Where you'll start owning. Early wins to target. Stakeholder map.",
    },
    {
      title: "Days 61–90 · Deliver",
      prompt: "What you'll deliver by day 90. Measurable outcomes.",
    },
    { title: "Risks & Asks", prompt: "What could go wrong, what you need from leadership." },
    { title: "Why Me", prompt: "Brief tie-back to your specific superpowers for this role." },
  ],
  tech_design_doc: [
    { title: "Problem & Context", prompt: "Frame the problem, why now, what you're solving." },
    { title: "Goals & Non-Goals", prompt: "What's in scope, what's explicitly out of scope." },
    { title: "Proposed Architecture", prompt: "High-level approach with diagrams in prose." },
    { title: "Tradeoffs", prompt: "Alternatives considered and why this won." },
    { title: "Rollout Plan", prompt: "How you'll ship safely. Phases. Migration." },
    { title: "Open Questions", prompt: "What still needs to be decided." },
  ],
  product_strategy: [
    {
      title: "Context & Market",
      prompt: "The state of the market and the company's position in it.",
    },
    { title: "Vision", prompt: "Where this product should be in 2-3 years." },
    { title: "Strategy & Bets", prompt: "The 3-5 bets you'd make to win." },
    { title: "Roadmap", prompt: "12-month roadmap shaped around the bets." },
    { title: "Risks", prompt: "What could derail this and your hedges." },
    { title: "Asks", prompt: "What you need from leadership / org." },
  ],
  gtm_plan: [
    { title: "Market & ICP", prompt: "Sized market, sharp ideal customer profile." },
    { title: "Positioning", prompt: "How you'll talk about the product. Differentiation." },
    { title: "Channel Mix", prompt: "Where the funnel lives. Channel-by-channel hypothesis." },
    { title: "Plays & Tactics", prompt: "Specific plays you'd run quarter 1." },
    { title: "Metrics & Targets", prompt: "Leading + lagging indicators with concrete numbers." },
    { title: "Resource Requirements", prompt: "Headcount, tooling, budget asks." },
  ],
  case_study: [
    {
      title: "Problem Framing",
      prompt: "How you understand the problem and any clarifying assumptions.",
    },
    { title: "Approach", prompt: "Your structured approach to solving it." },
    { title: "Analysis", prompt: "The substance — numbers, segments, user research, etc." },
    { title: "Recommendation", prompt: "What you would do and why." },
    { title: "Implementation Plan", prompt: "Sequencing and dependencies for the recommendation." },
    { title: "Risks & Mitigations", prompt: "What could go wrong and how you'd respond." },
  ],
  sales_pitch: [
    {
      title: "Target Account & Pain",
      prompt: "Who this is for and the specific pain you're solving.",
    },
    { title: "Solution", prompt: "How your offering maps to that pain." },
    { title: "Differentiation", prompt: "Why you, not competitor X." },
    { title: "Proof", prompt: "Customer outcomes, references, hard numbers." },
    { title: "Pricing & Commercial", prompt: "Commercial structure, pricing logic." },
    { title: "Close Plan", prompt: "Next steps to a signed deal." },
  ],
  eng_take_home: [
    { title: "Problem Restatement", prompt: "Restate the problem to confirm understanding." },
    { title: "Approach", prompt: "High-level approach and key decisions." },
    {
      title: "Implementation Notes",
      prompt: "Highlights of the implementation, key data structures, etc.",
    },
    { title: "Tradeoffs", prompt: "What you traded off and why (time, scope, complexity)." },
    { title: "Testing Strategy", prompt: "How you tested and what's covered." },
    {
      title: "Production Considerations",
      prompt: "What you'd add for prod (observability, scaling, etc).",
    },
  ],
  custom: [{ title: "Section 1", prompt: "AI will customize sections based on your brief." }],
};

export const extractProjectBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string; raw_brief: string; personal_request?: string }) =>
    z
      .object({
        job_id: z.string().uuid(),
        raw_brief: z.string().min(20).max(20000),
        personal_request: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_FLASH);

    const briefJsonShape = `{"deliverable_type":"30_60_90|tech_design_doc|product_strategy|gtm_plan|case_study|sales_pitch|eng_take_home|custom","requirements":["string"],"deadline":"string|null","audience":"string|null","format":"string|null","key_questions":["string"]}`;

    const { text: briefText } = await generateText({
      model,
      system: `You are a take-home assignment parser. Extract the deliverable type (best fit from the enum), explicit requirements, deadline if any, intended audience, suggested format, and the key questions the brief is really asking. Return null when unknown.\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure:\n${briefJsonShape}`,
      prompt: `Parse this assignment brief.\n\n${data.raw_brief}`,
    });
    const parsed = ExtractedBriefSchema.parse(JSON.parse(extractJsonText(briefText)));

    // Default title from job + deliverable type
    const { data: job } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", data.job_id)
      .maybeSingle();
    const title = `${job?.title ?? "Project"} — ${DELIVERABLE_LABELS[parsed.deliverable_type]}`;

    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        job_id: data.job_id,
        title,
        brief: data.raw_brief,
        extracted_brief: parsed as unknown as never,
        deliverable_type: parsed.deliverable_type,
        status: "briefing",
        personal_request: data.personal_request?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { project_id: row.id, parsed };
  });

export const listProjectsForJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { job_id: string }) => z.object({ job_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("projects")
      .select("id, title, deliverable_type, status, last_exported_at, updated_at")
      .eq("job_id", data.job_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAllProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("projects")
      .select("id, title, deliverable_type, status, job_id, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const jobIds = Array.from(new Set((rows ?? []).map((r) => r.job_id))) as string[];
    const jobs =
      jobIds.length === 0
        ? []
        : ((await supabase.from("jobs").select("id, title, company_id").in("id", jobIds)).data ??
          []);
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const companyIds = Array.from(
      new Set(jobs.map((j) => j.company_id).filter(Boolean)),
    ) as string[];
    const companies =
      companyIds.length === 0
        ? []
        : ((await supabase.from("companies").select("id, name").in("id", companyIds)).data ?? []);
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    return (rows ?? []).map((p) => ({
      ...p,
      job_title: jobMap.get(p.job_id)?.title ?? null,
      company_name: jobMap.get(p.job_id)?.company_id
        ? (companyMap.get(jobMap.get(p.job_id)!.company_id!)?.name ?? null)
        : null,
    }));
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string }) =>
    z.object({ project_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");
    if ((project as { user_id: string }).user_id !== userId) throw new Error("Forbidden");
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", project.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("companies").select("*").eq("id", job.company_id).maybeSingle()
      : { data: null };
    return { project, job, company };
  });

export const runDeeperResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string }) =>
    z.object({ project_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !project) throw new Error("Project not found");
    if ((project as { user_id: string }).user_id !== userId) throw new Error("Forbidden");

    const { data: job } = await supabase
      .from("jobs")
      .select("title, company_id")
      .eq("id", project.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("companies").select("name").eq("id", job.company_id).maybeSingle()
      : { data: null };

    const brief = (project as { extracted_brief?: ExtractedBrief | null }).extracted_brief;
    const keyQuestions = brief?.key_questions?.join("\n- ") ?? "(unspecified)";
    const personalRequest = (project as { personal_request?: string | null }).personal_request;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_PRO);

    const personalLens = personalRequest
      ? `\n\nCANDIDATE'S STRATEGIC LENS\n"${personalRequest}"\nSurface findings that directly connect to or support this angle. Where relevant, note how a finding can be framed through this lens in the final deliverable.`
      : "";

    const system = `You are a research analyst. The candidate has a take-home assignment from ${company?.name ?? "the company"}: produce a ${DELIVERABLE_LABELS[(project.deliverable_type ?? "custom") as DeliverableType]} addressing these key questions:\n- ${keyQuestions}\n\nDraw on what you know about the company, the market, and the deliverable type. Be specific where you can; be honest about what you don't know rather than inventing facts. Cite specific market data, customer types, or technical details when you have them.${personalLens}`;

    const researchJsonShape = `{"findings":[{"topic":"string","summary":"string","key_facts":["string"],"implications_for_deliverable":"string"}],"open_questions":["string"]}`;

    const { text: researchText } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure:\n${researchJsonShape}`,
      prompt: "Produce the structured research findings now. Aim for 5-8 substantive findings.",
    });
    const researchOutput = ResearchSchema.parse(JSON.parse(extractJsonText(researchText)));

    await supabase
      .from("projects")
      .update({
        research_notes: researchOutput as unknown as never,
        status: "researching",
      })
      .eq("id", project.id);

    return researchOutput;
  });

export const generateOutline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string }) =>
    z.object({ project_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !project) throw new Error("Project not found");
    if ((project as { user_id: string }).user_id !== userId) throw new Error("Forbidden");

    const dt = (project.deliverable_type ?? "custom") as DeliverableType;
    const skeleton = TEMPLATES[dt];

    const personalRequest = (project as { personal_request?: string | null }).personal_request;

    let outline: OutlineSection[];
    if (dt === "custom") {
      // Ask AI to generate sections from the brief
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
      const gateway = createLovableAiGatewayProvider(apiKey);
      const model = gateway(MODEL_FLASH);
      const outlineJsonShape = `{"sections":[{"title":"string","prompt":"string"}]}`;
      const OutlineSectionsSchema = z.object({
        sections: z.array(z.object({ title: z.string(), prompt: z.string() })),
      });
      const personalLens = personalRequest
        ? `\n\nCANDIDATE'S STRATEGIC LENS: "${personalRequest}"\nStructure the outline so it naturally explores and demonstrates this angle.`
        : "";
      const { text: outlineText } = await generateText({
        model,
        system: `Given a take-home brief, propose 5-8 logical sections for the deliverable. Each has a short title and a 1-sentence prompt describing what should go in it.\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure:\n${outlineJsonShape}${personalLens}`,
        prompt: `Brief: ${(project as { brief?: string }).brief ?? ""}`,
      });
      const outlineOutput = OutlineSectionsSchema.parse(JSON.parse(extractJsonText(outlineText)));
      outline = outlineOutput.sections.map((s, i) => ({
        id: `s${i + 1}`,
        title: s.title,
        prompt: s.prompt,
        content: "",
      }));
    } else {
      outline = skeleton.map((s, i) => ({
        id: `s${i + 1}`,
        title: s.title,
        prompt: s.prompt,
        content: "",
      }));
    }

    await supabase
      .from("projects")
      .update({ outline: outline as unknown as never, status: "outlining" })
      .eq("id", project.id);

    return outline;
  });

export const updatePersonalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string; personal_request: string }) =>
    z.object({ project_id: z.string().uuid(), personal_request: z.string().max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ personal_request: data.personal_request.trim() || null })
      .eq("id", data.project_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOutline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string; outline: OutlineSection[] }) =>
    z
      .object({
        project_id: z.string().uuid(),
        outline: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            prompt: z.string(),
            content: z.string(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .update({ outline: data.outline as unknown as never })
      .eq("id", data.project_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const draftSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      project_id: string;
      section_id: string;
      action: "draft" | "expand" | "tighten" | "rewrite_with_feedback";
      feedback?: string;
    }) =>
      z
        .object({
          project_id: z.string().uuid(),
          section_id: z.string(),
          action: z.enum(["draft", "expand", "tighten", "rewrite_with_feedback"]),
          feedback: z.string().optional(),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !project) throw new Error("Project not found");
    if ((project as { user_id: string }).user_id !== userId) throw new Error("Forbidden");

    const outline = ((project.outline ?? []) as OutlineSection[]).map((s) => ({ ...s }));
    const section = outline.find((s) => s.id === data.section_id);
    if (!section) throw new Error("Section not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("headline, domain, superpowers")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: job } = await supabase
      .from("jobs")
      .select("title, company_id")
      .eq("id", project.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("companies").select("name").eq("id", job.company_id).maybeSingle()
      : { data: null };

    const research = (project as { research_notes?: ResearchNotes | null }).research_notes;
    const personalRequest = (project as { personal_request?: string | null }).personal_request;
    const otherSections = outline
      .filter((s) => s.id !== data.section_id && s.content)
      .map((s) => `${s.title}:\n${s.content}`)
      .join("\n\n---\n\n");

    let actionInstruction: string;
    switch (data.action) {
      case "expand":
        actionInstruction =
          "Expand the existing content with more depth, specificity, and examples. Preserve voice.";
        break;
      case "tighten":
        actionInstruction =
          "Tighten the existing content. Cut filler. Sharpen claims. Keep substance.";
        break;
      case "rewrite_with_feedback":
        actionInstruction = `Rewrite the section incorporating this feedback: ${data.feedback ?? ""}`;
        break;
      default:
        actionInstruction = "Draft this section from scratch using the prompt and project context.";
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_PRO);

    const personalLens = personalRequest
      ? `\nCANDIDATE'S STRATEGIC LENS\n"${personalRequest}"\nWeave this angle naturally into the section — let it inform the framing, examples chosen, and recommendations made. Don't force it artificially, but where it fits, make it shine.\n`
      : "";

    const system = `You are an expert co-writer producing a section of a take-home deliverable. The deliverable is a ${DELIVERABLE_LABELS[(project.deliverable_type ?? "custom") as DeliverableType]} for ${company?.name ?? "a company"} (role: ${job?.title ?? "unspecified"}).

CANDIDATE
Headline: ${profile?.headline ?? "(unknown)"}
Domain: ${profile?.domain ?? "(unknown)"}
Superpowers: ${profile?.superpowers ?? "(none provided)"}
${personalLens}
SECTION
Title: ${section.title}
Prompt: ${section.prompt}
Existing content: ${section.content || "(empty)"}

OTHER SECTIONS (for coherence — avoid contradiction or duplication)
${otherSections || "(none yet)"}

RESEARCH FINDINGS
${research?.findings.map((f) => `- ${f.topic}: ${f.summary}`).join("\n") ?? "(none yet)"}

ACTION: ${actionInstruction}

Output clean GitHub-flavored Markdown. No top-level heading (the section title is rendered separately). Be specific, anchor to research findings where helpful, write in the candidate's voice.`;

    const { text } = await generateText({
      model,
      system,
      prompt: "Produce the section now.",
    });

    section.content = text;
    await supabase
      .from("projects")
      .update({ outline: outline as unknown as never, status: "drafting" })
      .eq("id", project.id);

    return { content: text };
  });

export const exportProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string; format: "pptx" | "docx" | "html" }) =>
    z
      .object({
        project_id: z.string().uuid(),
        format: z.enum(["pptx", "docx", "html"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.project_id)
      .maybeSingle();
    if (error || !project) throw new Error("Project not found");
    if ((project as { user_id: string }).user_id !== userId) throw new Error("Forbidden");
    // Most of the export work happens client-side using pptxgenjs/docx, since they're browser-friendly
    // Server just records the artifact metadata.
    const { data: row, error: artErr } = await supabase
      .from("project_artifacts")
      .insert({
        user_id: userId,
        project_id: data.project_id,
        format: data.format,
      })
      .select("id")
      .single();
    if (artErr) {
      console.warn("project_artifacts insert failed:", artErr.message);
    }
    await supabase
      .from("projects")
      .update({ last_exported_at: new Date().toISOString(), last_export_format: data.format })
      .eq("id", data.project_id);

    await supabase
      .from("analytics_events")
      .insert({
        user_id: userId,
        event_name: "project_exported",
        properties: { project_id: data.project_id, format: data.format } as unknown as never,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return { artifact_id: row?.id, project };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { project_id: string }) =>
    z.object({ project_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.project_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
