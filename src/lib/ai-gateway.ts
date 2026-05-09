import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * AI provider — routes through OpenRouter (https://openrouter.ai).
 *
 * Why OpenRouter:
 *  - One API key, many models (Claude, GPT-4o, Gemini, Llama, Mistral, etc.)
 *  - Different models can act as different interviewer personas — genuine
 *    diversity of conversational style and analytical angle, not just prompts.
 *  - Single-vendor billing, easier quota management.
 *  - Switching the default model is an env-var change, no redeploy required
 *    if Vercel reads env vars dynamically (they do at runtime).
 *
 * Voice mode (Gemini Live) is NOT routed through OpenRouter — the Live API
 * uses a unique WebSocket protocol Google offers exclusively. Voice continues
 * to use GEMINI_API_KEY directly via @google/genai (in src/hooks/use-voice-interview.ts).
 *
 * Usage at call sites:
 *   const provider = createAiProvider(process.env.OPENROUTER_API_KEY);
 *   const model = provider("anthropic/claude-sonnet-4.5"); // or any OpenRouter model id
 */

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";

// Faster/cheaper model for trivial tasks like job-description parsing.
// Override via OPENROUTER_MODEL_FAST env var.
export const FAST_MODEL = process.env.OPENROUTER_MODEL_FAST ?? "anthropic/claude-haiku-4.5";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const createAiProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "openrouter",
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter recommends these for analytics / leaderboard attribution.
      // Adjust the referer to your real Vercel URL once you have a custom domain.
      "HTTP-Referer": "https://supreme-broccoli.vercel.app",
      "X-Title": "Interview Compass",
    },
  });

// Backward-compat alias — keeps the old import name working at call sites.
// New code should use `createAiProvider`.
export const createLovableAiGatewayProvider = createAiProvider;
