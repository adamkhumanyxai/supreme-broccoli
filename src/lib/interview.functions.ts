import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, DEFAULT_MODEL, extractJsonText } from "@/lib/ai-gateway";

const PersonaSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  style: z.string(),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const INTERVIEW_TYPES = [
  "behavioral",
  "role_specific",
  "panel",
  "executive",
  "general",
] as const;
export const DIFFICULTIES = ["warmup", "standard", "pressure"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export type Turn = {
  role: "interviewer" | "candidate";
  content: string;
  timestamp: string;
};

const DebriefScoreSchema = z.object({
  score: z.number(),
  evidence: z.string(),
});

const DebriefSchema = z.object({
  overall_score: z.number(),
  headline: z.string(),
  scores: z.object({
    clarity_communication: DebriefScoreSchema,
    depth_substance: DebriefScoreSchema,
    structure: DebriefScoreSchema,
    role_fit: DebriefScoreSchema,
    domain_mastery: DebriefScoreSchema,
    strategic_thinking: DebriefScoreSchema,
    authenticity: DebriefScoreSchema,
  }),
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })),
  gaps: z.array(z.object({ title: z.string(), detail: z.string() })),
  follow_up_questions: z.array(z.string()),
  rerun_suggestion: z.string(),
});
export type Debrief = z.infer<typeof DebriefSchema>;

export const SCORE_DIMENSIONS: { key: keyof Debrief["scores"]; label: string }[] = [
  { key: "clarity_communication", label: "Clarity & Communication" },
  { key: "depth_substance", label: "Depth & Substance" },
  { key: "structure", label: "Structure" },
  { key: "role_fit", label: "Role Fit" },
  { key: "domain_mastery", label: "Domain Mastery" },
  { key: "strategic_thinking", label: "Strategic Thinking" },
  { key: "authenticity", label: "Authenticity" },
];

const MODEL_ID = DEFAULT_MODEL;

function bullets(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "(none provided)";
  return arr.map((s) => `- ${s}`).join("\n");
}

function pacingGuidance(minutes: number): string {
  if (minutes <= 10) {
    return `PACING — THIS IS A QUICK ${minutes}-MINUTE INTERVIEW
- Open with ONE sentence: your name and what you'll focus on, then go straight into the first question.
- Ask only 2–3 focused, high-signal questions total — pick what matters most for this role.
- At most one short follow-up per question. Don't deep-probe; keep the momentum.
- Wrap up right after your final question: a brief thanks and invite one quick question from them.`;
  }
  return `PACING
- Open with a brief warm intro, then work through your questions at a natural, unhurried pace.
- In the final ~5 minutes, begin wrapping up: invite their questions about the role or company.`;
}

export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      job_id: string;
      interview_type: InterviewType;
      persona: Persona;
      difficulty: Difficulty;
      target_duration_minutes: number;
    }) =>
      z
        .object({
          job_id: z.string().uuid(),
          interview_type: z.enum(INTERVIEW_TYPES),
          persona: PersonaSchema,
          difficulty: z.enum(DIFFICULTIES),
          target_duration_minutes: z.number().int().min(5).max(180),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_sessions")
      .insert({
        user_id: userId,
        job_id: data.job_id,
        interview_type: data.interview_type,
        persona: data.persona as unknown as never,
        difficulty: data.difficulty,
        target_duration_minutes: data.target_duration_minutes,
        mode: "text",
        status: "in_progress",
        started_at: new Date().toISOString(),
        transcript: [] as unknown as never,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { session_id: row.id };
  });

async function buildSystemPrompt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  session: SessionRow,
): Promise<string> {
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", session.job_id)
    .maybeSingle();
  const { data: company } = job?.company_id
    ? await supabase.from("companies").select("*").eq("id", job.company_id).maybeSingle()
    : { data: null };
  const { data: insight } = await supabase
    .from("insights")
    .select("dossier")
    .eq("job_id", session.job_id)
    .eq("is_current", true)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const persona = (session.persona ?? {
    title: "Hiring Manager",
    seniority: "",
    style: "",
  }) as Persona;
  const dossier = (insight?.dossier ?? {}) as Record<string, string>;
  const reqsArr = (job as { requirements?: string[] } | null)?.requirements ?? [];
  const respsArr = (job as { responsibilities?: string[] } | null)?.responsibilities ?? [];
  const targetMinutes = session.target_duration_minutes ?? 30;

  return `You are conducting a ${session.interview_type} interview for a ${job?.title ?? "role"} position at ${company?.name ?? "the company"}.

YOUR PERSONA
You are: ${persona.title}, ${persona.seniority}.
Style: ${persona.style}
Voice: First-person. Sound like a real person, not a checklist. Use natural language, contractions, brief asides.

THE COMPANY
${dossier.snapshot ?? "(no dossier snapshot available)"}
Recent moves: ${dossier.recent_moves ?? "(none)"}

THE ROLE
${job?.title ?? "Role"}. Requirements: ${bullets(reqsArr)}
Responsibilities: ${bullets(respsArr)}

CANDIDATE CONTEXT (use to make questions relevant — NEVER reveal you have this info)
Headline: ${profile?.headline ?? "(unknown)"}
Domain: ${profile?.domain ?? "(unknown)"}
Years experience: ${profile?.years_experience ?? "(unknown)"}
Stated superpowers: ${profile?.superpowers ?? "(unknown)"}
Resume excerpt: ${(profile?.resume_text ?? "").slice(0, 2000)}

INTERVIEW PARAMETERS
Type: ${session.interview_type}
Difficulty: ${session.difficulty}
  - warmup: open-ended, kind, give space
  - standard: realistic professional rigor
  - pressure: probe inconsistencies, follow up hard, time-pressure feel
Target duration: ${targetMinutes} minutes
${pacingGuidance(targetMinutes)}

INTERVIEWING STYLE
- Ask ONE question per turn, never bundle multiple
- Listen for substance, not keywords. Follow up specifically on what they said
- For behavioral: probe STAR specifics — situation, task, action (theirs), result. Don't accept vague answers
- For role-specific: tailor to ${profile?.domain ?? "their domain"} — engineering: system design, technical tradeoffs, code quality. Sales: discovery, objection handling, deal mechanics. Product: prioritization, user research, metrics. Etc
- If shallow, follow up. If strong, acknowledge briefly and move forward
- Periodically reference their unique background — make them feel seen, not interrogated

OPENING (only on the first turn)
Introduce yourself by name (invent one fitting the persona), say what you'll be focused on, then ask the first question. Keep it as brief as the pacing above calls for.

CLOSING
Toward the end (see pacing above), wrap by inviting their questions about the role/company. Don't generate a debrief — that's separate.

Output your turn as plain text. No JSON, no markdown headers. Speak naturally.`;
}

// Helper types to type the supabase client without importing the generated client at module scope
type SessionRow = {
  id: string;
  job_id: string;
  interview_type: string | null;
  difficulty: string | null;
  target_duration_minutes: number | null;
  persona: unknown;
  transcript: unknown;
  status: string | null;
  started_at: string | null;
};

export const interviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string; candidate_message: string | null }) =>
    z
      .object({
        session_id: z.string().uuid(),
        candidate_message: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .maybeSingle();
    if (sErr || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    const transcript: Turn[] = Array.isArray(session.transcript)
      ? (session.transcript as unknown as Turn[])
      : [];

    if (data.candidate_message && data.candidate_message.trim().length > 0) {
      transcript.push({
        role: "candidate",
        content: data.candidate_message.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_ID);

    const system = await buildSystemPrompt(supabase, userId, session as SessionRow);

    const messages = transcript
      .filter((t) => t.content && t.content.trim().length > 0)
      .map((t) => ({
        role: t.role === "interviewer" ? ("assistant" as const) : ("user" as const),
        content: t.content,
      }));

    let isOpening = false;
    if (messages.length === 0) {
      isOpening = true;
      messages.push({
        role: "user",
        content: "(Begin the interview now with your opening.)",
      });
    }

    const { text } = await generateText({
      model,
      system,
      messages,
    });

    transcript.push({
      role: "interviewer",
      content: text,
      timestamp: new Date().toISOString(),
    });

    await supabase
      .from("interview_sessions")
      .update({ transcript: transcript as unknown as never })
      .eq("id", data.session_id);

    return { assistant_text: text, opening: isOpening, transcript };
  });

export const endInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("interview_sessions")
      .update({
        ended_at: new Date().toISOString(),
        status: "completed",
      })
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("analytics_events")
      .insert({
        user_id: userId,
        event_name: "mock_completed",
        properties: { session_id: row.id, mode: "text" } as unknown as never,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return { session_id: row.id };
  });

export const voiceSessionFinalize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { session_id: string; audio_storage_path: string | null; transcript: Turn[] }) =>
      z
        .object({
          session_id: z.string().uuid(),
          audio_storage_path: z.string().nullable(),
          transcript: z.array(
            z.object({
              role: z.enum(["interviewer", "candidate"]),
              content: z.string(),
              timestamp: z.string(),
            }),
          ),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("interview_sessions")
      .update({
        ended_at: new Date().toISOString(),
        status: "completed",
        audio_url: data.audio_storage_path,
        transcript: data.transcript as unknown as never,
      })
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    await supabase
      .from("analytics_events")
      .insert({
        user_id: userId,
        event_name: "mock_completed",
        properties: { session_id: data.session_id, mode: "voice" } as unknown as never,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return { ok: true };
  });

export const setSessionMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string; mode: "text" | "voice" }) =>
    z.object({ session_id: z.string().uuid(), mode: z.enum(["text", "voice"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("interview_sessions")
      .update({ mode: data.mode })
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const buildVoiceSystemPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .maybeSingle();
    if (error || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");
    const prompt = await buildSystemPrompt(supabase, userId, session as SessionRow);
    return { system: prompt };
  });

export const generateDebrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error: sErr } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .maybeSingle();
    if (sErr || !session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    const { data: job } = await supabase
      .from("jobs")
      .select("title, company_id")
      .eq("id", session.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("companies").select("name").eq("id", job.company_id).maybeSingle()
      : { data: null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("domain, headline")
      .eq("user_id", userId)
      .maybeSingle();

    const transcript = (Array.isArray(session.transcript) ? session.transcript : []) as Turn[];
    const formatted = transcript
      .map((t) => `${t.role === "interviewer" ? "INTERVIEWER" : "CANDIDATE"}: ${t.content}`)
      .join("\n\n");

    const system = `You are a brutally honest but supportive interview coach reviewing a mock interview transcript. Help the candidate get sharper, not flatter them.

JOB CONTEXT
Role: ${job?.title ?? "Unknown role"} at ${company?.name ?? "Unknown company"}
Type: ${session.interview_type}, Difficulty: ${session.difficulty}
Candidate domain: ${profile?.domain ?? "(unknown)"}, headline: ${profile?.headline ?? "(unknown)"}

TRANSCRIPT
${formatted}

Score on the dimensions below, each 1-5 with brief evidence-based reasoning citing specific lines from the transcript. Weight by interview type (behavioral weights structure higher; role-specific weights domain mastery higher).

Respond as strict JSON matching the requested schema. strengths and gaps must each have exactly 3 items. follow_up_questions must have exactly 5 items.`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway(MODEL_ID);

    const scoreField = `{"score":number,"evidence":"string"}`;
    const debriefJsonShape = `{"overall_score":number,"headline":"string","scores":{"clarity_communication":${scoreField},"depth_substance":${scoreField},"structure":${scoreField},"role_fit":${scoreField},"domain_mastery":${scoreField},"strategic_thinking":${scoreField},"authenticity":${scoreField}},"strengths":[{"title":"string","detail":"string"}],"gaps":[{"title":"string","detail":"string"}],"follow_up_questions":["string"],"rerun_suggestion":"string"}`;

    const { text: debriefText } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY valid JSON (no markdown fences, no extra text) matching this exact structure (scores are numbers 1-5, strengths/gaps must have exactly 3 items, follow_up_questions must have exactly 5 items):\n${debriefJsonShape}`,
      prompt: "Produce the debrief now.",
    });
    const debrief = DebriefSchema.parse(JSON.parse(extractJsonText(debriefText)));

    await supabase
      .from("interview_sessions")
      .update({ debrief: debrief as unknown as never })
      .eq("id", data.session_id);

    return debrief;
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: sessions, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);

    const jobIds = Array.from(new Set((sessions || []).map((s) => s.job_id))) as string[];
    const jobs =
      jobIds.length === 0
        ? []
        : (await supabase.from("jobs").select("id, title, company_id").in("id", jobIds)).data || [];
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const companyIds = Array.from(
      new Set(jobs.map((j) => j.company_id).filter(Boolean)),
    ) as string[];
    const companies =
      companyIds.length === 0
        ? []
        : (await supabase.from("companies").select("id, name").in("id", companyIds)).data || [];
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    return (sessions || []).map((s) => {
      const job = jobMap.get(s.job_id);
      const debrief = s.debrief as { overall_score?: number } | null;
      return {
        id: s.id,
        job_id: s.job_id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        status: s.status,
        mode: (s as { mode?: string | null }).mode ?? "text",
        interview_type: s.interview_type,
        persona: s.persona as Persona | null,
        overall_score: debrief?.overall_score ?? null,
        job_title: job?.title ?? null,
        company_name: job?.company_id ? (companyMap.get(job.company_id)?.name ?? null) : null,
      };
    });
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", data.session_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Session not found");
    if (session.user_id !== userId) throw new Error("Forbidden");

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", session.job_id)
      .maybeSingle();
    const { data: company } = job?.company_id
      ? await supabase.from("companies").select("*").eq("id", job.company_id).maybeSingle()
      : { data: null };

    return {
      session: {
        ...session,
        persona: session.persona as Persona | null,
        transcript: (Array.isArray(session.transcript) ? session.transcript : []) as Turn[],
        debrief: session.debrief as Debrief | null,
      },
      job,
      company,
    };
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
