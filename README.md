# Interview Compass

AI-powered interview preparation. Real company intel, voice-enabled mock interviews, and a take-home project builder — wired to specific roles you're chasing and what makes you good at this.

Built on TanStack Start (React 19) + Supabase + Google Gemini via the Lovable AI Gateway. Designed for personal use first; multi-tenant from day 1.

---

## Stack

- **Frontend**: React 19, TanStack Router (file-based), TanStack Query, shadcn/ui, Tailwind v4
- **Backend**: TanStack Start server functions (no separate API server)
- **Database / Auth / Storage**: Supabase (Postgres + Storage with RLS)
- **AI (text)**: OpenRouter via Vercel AI SDK + `@ai-sdk/openai-compatible`. Default model is `anthropic/claude-sonnet-4.5`, configurable per-deploy via `OPENROUTER_MODEL`. Same key works across Claude, GPT-4o, Gemini, Llama, Mistral, Perplexity Sonar, etc. — change models without code changes.
- **AI (voice)**: `@google/genai` for Gemini Live (real-time speech-to-speech). Voice is the one feature OpenRouter can't proxy — it requires a unique WebSocket protocol Google offers exclusively. Voice mode silently falls back to text mode if `GEMINI_API_KEY` is not set.
- **Exports**: `pptxgenjs`, `docx`, browser print-to-PDF

---

## Local development

```bash
bun install
cp .env.example .env
# Fill in .env with your Supabase + LOVABLE_API_KEY (and GEMINI_API_KEY for voice)
bun dev
```

App runs at `http://localhost:5173` by default.

### Required environment variables

| Variable                        | Purpose                                                                     | Where it goes |
| ------------------------------- | --------------------------------------------------------------------------- | ------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL (browser)                                              | `.env`        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (browser)                                                 | `.env`        |
| `VITE_SUPABASE_PROJECT_ID`      | Supabase project ref                                                        | `.env`        |
| `SUPABASE_URL`                  | Same URL, server-side                                                       | `.env`        |
| `SUPABASE_PUBLISHABLE_KEY`      | Same anon key, server-side                                                  | `.env`        |
| `OPENROUTER_API_KEY`            | OpenRouter key — powers all text-mode AI calls                              | `.env`        |
| `OPENROUTER_MODEL`              | (optional) default model id, e.g. `anthropic/claude-sonnet-4.5`             | `.env`        |
| `OPENROUTER_MODEL_FAST`         | (optional) cheap model for parsing tasks, e.g. `anthropic/claude-haiku-4.5` | `.env`        |
| `GEMINI_API_KEY`                | (optional) Google Gemini key — only needed for voice-mode mock interviewer  | `.env`        |

Without `OPENROUTER_API_KEY`, AI flows error. Without `GEMINI_API_KEY`, voice mode silently falls back to text mode (designed safety net).

---

## Database setup

Apply migrations via the Supabase Dashboard SQL Editor (paste each `.sql` file under `supabase/migrations/` in chronological order), or via the Supabase CLI:

```bash
supabase db push
```

Migrations create:

- Profiles, companies, jobs, insights, interview_sessions, projects, project_artifacts, user_settings, analytics_events
- RLS policies on every user-data table (own-rows-only)
- Storage bucket `user-files` with per-user folder isolation
- Triggers to auto-create profile + user_settings rows on signup

---

## Deploy to Vercel

1. **Connect the GitHub repo** — Vercel → Add New Project → Import your repo
2. **Framework preset**: select **Vite** (Vercel auto-detects, but TanStack Start ships its own Vercel adapter via `target: "vercel"` in `vite.config.ts` so the build output is Vercel-ready)
3. **Build command**: `bun run build` (or `npm run build`)
4. **Output directory**: `.output` (TanStack Start's Nitro output — Vercel adapter writes here)
5. **Environment variables** — copy every key from `.env.example` into Vercel's project settings → Environment Variables. Also tick "Production", "Preview", and "Development" for each.
6. **First deploy** — Vercel runs the build; if successful you get a `*.vercel.app` URL.

---

## Features

### Company Insights

Paste a job description URL or text → AI generates a 10-section dossier with web grounding (Snapshot, Business Model, Financials, Culture, Leadership, Recent Moves, Competitive Landscape, Domain Context, Likely Themes, Smart Questions). Versioned, regenerable, exportable.

### Mock Interviewer

Pick interview type (behavioral / role-specific / panel / executive / general), persona (adapts to your domain), difficulty, and duration. Run text or voice mode. Voice mode uses Gemini Live for real-time speech-to-speech with interruption handling. Get a brutally-honest rubric-scored debrief with specific transcript references.

### Project Builder

Got a take-home? Paste the brief — AI extracts requirements, runs deeper research (with grounding), generates an outline matched to the deliverable type (30/60/90 plan, technical design doc, GTM plan, case study, etc.), and helps you draft each section. Export to PPTX, DOCX, or HTML.

### Polish

Light/dark mode, public landing, onboarding wizard, settings page (data export, account delete, retention controls), `/admin/rls-test` for verifying user isolation, simple per-user analytics funnel.

---

## Repository structure

```
src/
├── routes/                          # File-based routes (TanStack Router)
│   ├── __root.tsx
│   ├── index.tsx                    # Public landing
│   ├── auth.tsx                     # Sign in / sign up
│   ├── privacy.tsx                  # Privacy policy
│   ├── api/
│   │   └── gemini-token.ts          # Server route — mints Gemini Live ephemeral tokens
│   └── _authenticated/
│       ├── dashboard.tsx
│       ├── jobs/                    # Jobs + insights + mock interviews + projects
│       ├── projects/                # Top-level project list + workspace
│       ├── sessions.tsx             # All past mock sessions
│       ├── settings.tsx             # Tabbed settings (appearance / privacy / about)
│       ├── onboarding.tsx           # 4-step wizard
│       └── admin/                   # rls-test + funnel
├── lib/
│   ├── insights.functions.ts        # Server fn — dossier generation
│   ├── interview.functions.ts       # Server fns — mock interview lifecycle
│   ├── projects.functions.ts        # Server fns — project builder
│   ├── settings.functions.ts        # Server fns — user settings, data export, delete
│   └── jobs.functions.ts            # Server fns — job intake / list
├── hooks/
│   ├── use-voice-interview.ts       # Gemini Live browser client
│   └── use-theme.ts                 # Dark / light theme
└── integrations/supabase/
    ├── auth-middleware.ts           # JWT verification middleware for server fns
    ├── client.ts                    # Browser supabase-js
    └── types.ts                     # Generated DB types

supabase/migrations/                 # Apply via dashboard SQL Editor or `supabase db push`
public/audio-processor-worklet.js    # PCM16 encoder for voice input
HANDOFF.md                           # Full delivery notes + smoke tests
```

---

## License

Personal project. No license — all rights reserved by the author.
