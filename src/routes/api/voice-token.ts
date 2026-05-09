import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/voice-token")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});

/**
 * Mints an ephemeral OpenAI Realtime session for browser WebRTC voice interviews.
 *
 * Two modes:
 *  - Probe (no body): checks whether OPENAI_API_KEY is configured; returns
 *    { voice_available: true/false } without creating a session.
 *  - Full (body with { instructions, voice }): creates a Realtime session with
 *    the interview system prompt baked in, returns { client_secret, voice_available: true }.
 *
 * The client uses client_secret.value as the ephemeral Bearer token for the
 * WebRTC SDP exchange directly with api.openai.com.
 */
async function handler({ request }: { request: Request }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const verify = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
        },
      });
      if (!verify.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("Token verify failed", e);
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ voice_available: false });
  }

  // Parse body — absence of instructions means this is a capability probe
  let instructions: string | undefined;
  let voice: string | undefined;
  try {
    const body = await request.json() as { instructions?: string; voice?: string };
    instructions = body.instructions;
    voice = body.voice;
  } catch (_) {
    // No body — probe only
  }

  if (!instructions) {
    return Response.json({ voice_available: true });
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        voice: voice ?? "alloy",
        instructions,
        modalities: ["text", "audio"],
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
          create_response: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI realtime session failed:", res.status, errText);
      return Response.json(
        { error: "Failed to create realtime session", voice_available: false },
        { status: 502 },
      );
    }

    const data = await res.json() as { client_secret: { value: string } };
    return Response.json({ client_secret: data.client_secret, voice_available: true });
  } catch (e) {
    console.error("Voice token error", e);
    return Response.json({ error: "Token error", voice_available: false }, { status: 500 });
  }
}
