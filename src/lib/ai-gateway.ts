import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Direct Google Gemini provider. Uses GEMINI_API_KEY for auth.
 *
 * Previously this routed through the Lovable AI Gateway (`ai.gateway.lovable.dev`)
 * for unified billing through Lovable Cloud. That gateway requires a `LOVABLE_API_KEY`
 * which is only auto-injected inside Lovable Cloud and isn't available for external
 * deployment (Vercel, etc.). Switched to the native Google provider so the same
 * `GEMINI_API_KEY` powers BOTH text-mode (this file) AND voice-mode (Gemini Live).
 *
 * Bonus: `providerOptions: { google: { useSearchGrounding: true } }` now actually
 * propagates correctly (the Lovable Gateway likely silently dropped it).
 *
 * Usage at call sites:
 *   const provider = createAiProvider(process.env.GEMINI_API_KEY);
 *   const model = provider("gemini-2.5-pro"); // or "gemini-2.5-flash"
 */
export const createAiProvider = (apiKey: string) => {
  const provider = createGoogleGenerativeAI({ apiKey });
  return (modelId: string) => {
    // Strip legacy "google/" prefix if any caller still passes it.
    const id = modelId.startsWith("google/") ? modelId.slice("google/".length) : modelId;
    return provider(id);
  };
};

// Backward-compatible alias — keeps the old import name working at call sites
// while the rename phases in. Same factory shape, clearer name.
export const createLovableAiGatewayProvider = createAiProvider;
