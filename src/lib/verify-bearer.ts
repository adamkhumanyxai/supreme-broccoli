import { createClient } from "@supabase/supabase-js";

/**
 * Validates the Supabase access token on a raw fetch Request (used by the
 * /api/* route handlers, which don't run through the server-fn auth middleware).
 *
 * Returns the authenticated user id, or null if the token is missing/invalid.
 * Unlike a bare `startsWith("Bearer ")` check, this verifies the JWT against
 * Supabase so the endpoint can't be used as an anonymous proxy to the paid
 * OpenAI / OpenRouter / ElevenLabs APIs.
 */
export async function verifyBearerToken(request: Request): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[verify-bearer] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
    return null;
  }

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return { userId: data.claims.sub as string };
}
