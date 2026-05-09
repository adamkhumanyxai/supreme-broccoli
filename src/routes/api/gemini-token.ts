import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gemini-token")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
});

/**
 * Mints an ephemeral auth token for Gemini Live API usage from the browser.
 * Returns a STUB response when GEMINI_API_KEY isn't set so the client falls
 * back gracefully to text mode.
 *
 * Real auth tokens API: POST https://generativelanguage.googleapis.com/v1beta/auth_tokens
 * Tokens are short-lived (~30 min) and scoped to a single Live session.
 */
async function handler({ request }: { request: Request }) {
  // Validate Supabase JWT
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

  const apiKey = process.env.GEMINI_API_KEY;
  const stubExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  if (!apiKey) {
    return Response.json({
      token: "STUB",
      expires_at: stubExpires,
      voice_available: false,
    });
  }

  try {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    const newSessionExpiresAt = new Date(Date.now() + 60 * 1000); // 60s
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/auth_tokens?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            uses: 1,
            expireTime: expiresAt.toISOString(),
            newSessionExpireTime: newSessionExpiresAt.toISOString(),
            httpOptions: { apiVersion: "v1alpha" },
          },
        }),
      },
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini auth_tokens failed:", res.status, errText);
      return Response.json(
        { error: "Failed to mint Gemini token", detail: errText, voice_available: false },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) {
      console.error("Gemini auth_tokens returned no name field:", data);
      return Response.json(
        { error: "Token mint returned no name", voice_available: false },
        { status: 502 },
      );
    }
    return Response.json({
      token: data.name,
      expires_at: expiresAt.toISOString(),
      voice_available: true,
      model: "gemini-2.5-flash-preview-native-audio-dialog",
    });
  } catch (e) {
    console.error("Gemini token mint error", e);
    return Response.json(
      { error: "Token mint exception", voice_available: false },
      { status: 500 },
    );
  }
}
