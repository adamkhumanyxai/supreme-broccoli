import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// TanStack Start v1 + Vercel deployment.
// `nitro/vite` is the Nitro Vite plugin — it auto-detects Vercel's build env
// and writes output to `.vercel/output/` (Build Output API v3) so Vercel
// runs server functions correctly. Without it, you get a Node SSR build to
// `dist/server/server.js` which Vercel can't serve.
// Reference: https://vercel.com/docs/frameworks/full-stack/tanstack-start
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    nitro({
      // Nitro v3 bundles ALL production deps by default. `traceDeps` keeps these
      // as external runtime imports instead of bundling. Required because:
      //  - @google/genai is browser-only (used only in src/hooks/use-voice-interview.ts)
      //  - It pulls in `ws`, which references Node's built-in `https` module
      //  - The bundler tries to resolve `https` as an npm package and fails
      // Marking them traced means the server never bundles them; runtime never
      // tries to load them either, since the dynamic import only fires in the browser.
      traceDeps: ["@google/genai", "ws"],
    }),
    viteReact(),
  ],
});
