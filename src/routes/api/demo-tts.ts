import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/demo-tts")({
  server: {
    handlers: {
      POST: handler,
    },
  },
});

/**
 * Generates ElevenLabs TTS audio for the demo interview.
 *  role === "interviewer" → ELEVENLABS_VOICE_ID (default: Bill, Australian male)
 *  role === "candidate"   → ELEVENLABS_DEMO_VOICE_ID (default: AGxqDIZpj4LgDVWBCgVP, voice clone)
 */
async function handler({ request }: { request: Request }) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
  }

  const interviewerVoiceId = process.env.ELEVENLABS_VOICE_ID ?? "pqHfZKP75CvOlQylNhV4";
  const candidateVoiceId = process.env.ELEVENLABS_DEMO_VOICE_ID ?? "AGxqDIZpj4LgDVWBCgVP";

  let text: string;
  let role: string;
  try {
    const body = await request.json() as { text: string; role: string };
    text = body.text?.trim();
    role = body.role;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text) return Response.json({ error: "text is required" }, { status: 400 });

  const voiceId = role === "candidate" ? candidateVoiceId : interviewerVoiceId;

  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": elevenKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!ttsRes.ok) {
    const err = await ttsRes.text();
    console.error("[demo-tts] elevenlabs failed:", ttsRes.status, err);
    return Response.json({ error: `TTS failed (${ttsRes.status})` }, { status: 502 });
  }

  const buf = await ttsRes.arrayBuffer();
  return Response.json({ audio_b64: Buffer.from(buf).toString("base64") });
}
