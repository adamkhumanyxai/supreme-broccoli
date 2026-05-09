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
      // `ws` is kept external (traced) rather than bundled. Nitro v3 bundles
      // all prod deps by default; bundling ws pulls in Node's built-in `https`
      // which the bundler can't resolve as an npm package.
      traceDeps: ["ws"],
    }),
    viteReact(),
  ],
});
