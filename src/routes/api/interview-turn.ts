import { createFileRoute } from "@tanstack/react-router";
import { verifyBearerToken } from "@/lib/verify-bearer";

export const Route = createFileRoute("/api/interview-turn")({
  server: {
    handlers: {
      POST: handler,
    },
  },
});

/**
 * Single-turn voice interview endpoint.
 *
 * POST modes:
 *  - Probe (no multipart body): returns { voice_available: bool } based on env vars.
 *  - Opening turn (FormData with start="true", no audio): generates interviewer opening + TTS.
 *  - Regular turn (FormData with audio blob + messages + system_instruction): Whisper → LLM → ElevenLabs.
 *
 * Required env vars:
 *  OPENAI_API_KEY       — Whisper STT
 *  OPENROUTER_API_KEY   — LLM response generation
 *  ELEVENLABS_API_KEY   — TTS synthesis
 *
 * Optional:
 *  ELEVENLABS_VOICE_ID  — defaults to "pqHfZKP75CvOlQylNhV4" (Bill, Australian male)
 *  OPENROUTER_MODEL     — defaults to "openai/gpt-4o"
 */
async function handler({ request }: { request: Request }) {
  const openaiKey = process.env.OPENAI_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "pqHfZKP75CvOlQylNhV4";
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  // Probe mode: no multipart body
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return Response.json({ voice_available: !!(openaiKey && elevenKey && openrouterKey) });
  }

  // Auth check — validate the JWT, not just the header shape, so this paid-API
  // proxy can't be called anonymously.
  const authed = await verifyBearerToken(request);
  if (!authed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!openaiKey || !elevenKey || !openrouterKey) {
    const missing = [
      !openaiKey && "OPENAI_API_KEY",
      !elevenKey && "ELEVENLABS_API_KEY",
      !openrouterKey && "OPENROUTER_API_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    return Response.json({ error: `Voice not configured (${missing} missing)` }, { status: 503 });
  }

  const formData = await request.formData();
  const audioFile = formData.get("audio") as File | null;
  const messagesJson = (formData.get("messages") as string) ?? "[]";
  const systemInstruction = (formData.get("system_instruction") as string) ?? "";
  const isStart = formData.get("start") === "true";

  let userText = "";

  // Step 1: Transcribe audio via OpenAI Whisper (skip for opening turn)
  if (!isStart && audioFile && audioFile.size > 0) {
    const tfd = new FormData();
    tfd.append("file", audioFile, "audio.webm");
    tfd.append("model", "whisper-1");
    tfd.append("language", "en");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: tfd,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      console.error("[interview-turn] whisper failed:", whisperRes.status, err);
      return Response.json(
        { error: `Transcription failed (${whisperRes.status})` },
        { status: 502 },
      );
    }

    const wd = (await whisperRes.json()) as { text: string };
    userText = wd.text.trim();

    // Nothing audible — restart listening
    if (!userText) {
      return Response.json({ user_text: "", ai_text: "", audio_b64: null });
    }
  }

  // Step 2: Generate AI response via OpenRouter
  const messages = JSON.parse(messagesJson) as Array<{ role: string; content: string }>;
  if (userText) {
    messages.push({ role: "user", content: userText });
  }

  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o";
  const chatRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://supreme-broccoli.vercel.app",
      "X-Title": "Interview Compass",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemInstruction.trim() ? [{ role: "system", content: systemInstruction }] : []),
        ...messages.filter((m) => m.content && m.content.trim().length > 0),
      ],
      max_tokens: 350,
    }),
  });

  if (!chatRes.ok) {
    const err = await chatRes.text();
    console.error("[interview-turn] openrouter failed:", chatRes.status, err);
    return Response.json({ error: `AI response failed (${chatRes.status})` }, { status: 502 });
  }

  const chatData = (await chatRes.json()) as { choices: Array<{ message: { content: string } }> };
  const aiText = chatData.choices[0]?.message?.content?.trim() ?? "";

  // Step 3: ElevenLabs TTS
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": elevenKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: aiText,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!ttsRes.ok) {
    const ttsErr = await ttsRes.text();
    console.error("[interview-turn] elevenlabs failed:", ttsRes.status, ttsErr);
    // Return text even when TTS fails so transcript still updates
    return Response.json({ user_text: userText, ai_text: aiText, audio_b64: null });
  }

  const audioBuffer = await ttsRes.arrayBuffer();
  const audioB64 = Buffer.from(audioBuffer).toString("base64");

  return Response.json({
    user_text: userText,
    ai_text: aiText,
    audio_b64: audioB64,
    audio_mime: "audio/mpeg",
  });
}
