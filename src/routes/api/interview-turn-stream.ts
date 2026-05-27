import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway";
import { buildSystemPrompt, type SessionRow, type Turn } from "@/lib/interview.functions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/interview-turn-stream")({
  server: {
    handlers: {
      POST: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7); // remove "Bearer "

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return Response.json({ error: "Unauthorized: invalid token" }, { status: 401 });
  }
  const userId = claimsData.claims.sub as string;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { session_id?: string; candidate_message?: string | null };
  try {
    body = (await request.json()) as { session_id?: string; candidate_message?: string | null };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session_id, candidate_message } = body;
  if (!session_id || typeof session_id !== "string") {
    return Response.json({ error: "session_id is required" }, { status: 400 });
  }

  // ── Load session ───────────────────────────────────────────────────────────
  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", session_id)
    .maybeSingle();

  if (sErr || !session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.user_id !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Build transcript ───────────────────────────────────────────────────────
  const transcript: Turn[] = Array.isArray(session.transcript)
    ? (session.transcript as unknown as Turn[])
    : [];

  if (candidate_message && candidate_message.trim().length > 0) {
    transcript.push({
      role: "candidate",
      content: candidate_message.trim(),
      timestamp: new Date().toISOString(),
    });
  }

  // ── Build system prompt ────────────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENROUTER_API_KEY missing" }, { status: 503 });
  }

  const system = await buildSystemPrompt(supabase, userId, session as SessionRow);

  const messages = transcript.map((t) => ({
    role: t.role === "interviewer" ? ("assistant" as const) : ("user" as const),
    content: t.content,
  }));

  // Opening turn — seed a synthetic user message so the model speaks first
  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "(Begin the interview now with your opening.)",
    });
  }

  // ── Stream ─────────────────────────────────────────────────────────────────
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(DEFAULT_MODEL);

  const result = streamText({
    model,
    system,
    messages,
    // After the stream completes, persist the interviewer turn to the DB
    onFinish: async ({ text }) => {
      const finalTranscript: Turn[] = [
        ...transcript,
        {
          role: "interviewer",
          content: text,
          timestamp: new Date().toISOString(),
        },
      ];
      await supabase
        .from("interview_sessions")
        .update({ transcript: finalTranscript as unknown as never })
        .eq("id", session_id);
    },
  });

  // toDataStreamResponse streams AI SDK data-stream protocol so the client
  // can use the AI SDK's readDataStream / useCompletion helpers.
  // We also expose it as a plain text stream so a simple TextDecoder works.
  return result.toTextStreamResponse({
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
