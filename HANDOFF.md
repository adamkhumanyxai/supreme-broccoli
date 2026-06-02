# Interview Compass — Bundle B + Bundle C Handoff

## What's new since Bundle A

**Bundle B — Voice Mock Interviewer (Phase 2b)**

- `src/routes/api/gemini-token.ts` — real ephemeral-token minting against Gemini auth_tokens API. Returns `{ voice_available: false }` stub when `GEMINI_API_KEY` isn't set, so client falls back to text gracefully.
- `public/audio-processor-worklet.js` — PCM16 mono encoder for mic input.
- `src/hooks/use-voice-interview.ts` — full Gemini Live client. Mic capture (16kHz), audio playback (24kHz), live transcript via input/output transcription, interruption handling, MediaRecorder for session audio, mute toggle.
- `src/lib/interview.functions.ts` — added `voiceSessionFinalize`, `setSessionMode`, `buildVoiceSystemPrompt`. `listSessions` now exposes `mode`.
- `src/routes/_authenticated/jobs/$jobId/mock/new.tsx` — voice mode toggle (auto-disables on unsupported browsers / missing API key).
- `src/routes/_authenticated/jobs/$jobId/mock/$sessionId/index.tsx` — branches text vs voice UI. Voice page has stage avatar, audio level meter, live transcript, mute, end-and-finalize (uploads webm to storage).
- `src/routes/_authenticated/jobs/$jobId/mock/$sessionId/debrief.tsx` — embeds an `<audio>` player when `audio_url` is present.
- `src/routes/_authenticated/sessions.tsx` — mic icon next to voice sessions in the table.

**Bundle C — Project Builder + Polish (Phase 3 + 4)**

- `src/lib/projects.functions.ts` — `extractProjectBrief`, `runDeeperResearch` (with Gemini search grounding), `generateOutline` (8 deliverable templates), `draftSection` (draft / expand / tighten / rewrite_with_feedback), `updateOutline`, `exportProject`.
- `src/routes/_authenticated/jobs/$jobId/projects/{index,new}.tsx` — per-job project list + brief intake.
- `src/routes/_authenticated/projects/index.tsx` — top-level project list.
- `src/routes/_authenticated/projects/$projectId.tsx` — workspace with Brief / Research / Outline / Drafting tabs. Drafting uses textarea + AI buttons. Export menu generates PPTX (pptxgenjs), DOCX (docx), and HTML (printable to PDF).
- `src/lib/settings.functions.ts` — `getUserSettings`, `updateUserSettings`, `dataExport`, `accountDelete`, `trackEvent`, `getFunnelCounts`.
- `src/routes/_authenticated/settings.tsx` — full tabbed settings page (Appearance / Privacy & Data / Profile link / About) with theme switcher, retention sliders, data export, account delete.
- `src/routes/_authenticated/onboarding.tsx` — 4-step welcome wizard. Auto-redirected to on first sign-in.
- `src/routes/index.tsx` — public landing page at `/` (redirects authed users to `/dashboard`).
- `src/routes/privacy.tsx` — privacy policy page.
- `src/routes/_authenticated/admin/rls-test.tsx` — RLS isolation harness; run as Adam, then as JP, confirm zero leakage.
- `src/hooks/use-theme.ts` — light/dark theme persistence with localStorage + `data-theme` attr.
- `src/styles.css` — light theme CSS variables under `[data-theme="light"]`.
- `src/routes/_authenticated.tsx` — sidebar nav now: Dashboard / Jobs / Sessions / Projects / Profile / Settings. Onboarding gate redirects new users to `/onboarding`. Theme applied on every page load.
- `src/routes/_authenticated/dashboard.tsx` (was `index.tsx`) — moved to `/dashboard`. Adds quick-access buttons for Sessions and Projects.

## SETUP — read this carefully

### 1. Apply migrations to Supabase

The new migration is `supabase/migrations/20260509000000_bundle_b_c.sql`. Apply it via:

**Option A (Supabase Dashboard)** — recommended:

1. Go to your Supabase project → **SQL Editor** → New query
2. Paste the entire contents of `20260509000000_bundle_b_c.sql`
3. Run it
4. Verify in Table Editor: `user_settings`, `analytics_events`, `project_artifacts` exist; `projects` has new columns

**Option B (CLI)** — if you have Supabase CLI installed:

```bash
supabase db push
```

### 2. Set GEMINI_API_KEY

Get a key at [aistudio.google.com](https://aistudio.google.com) → API keys.

Add it wherever the app runs:

- **Local dev**: append `GEMINI_API_KEY=AIza...` to `.env`
- **Lovable Cloud** (when credits return): Cloud panel → Environment variables → add `GEMINI_API_KEY`
- **Vercel / Cloudflare**: dashboard env vars

Without it, voice mode silently falls back to text mode (intentional safety net).

### 3. Install deps and run

```bash
cd interview-compass-final
bun install
bun dev
```

The TanStack router plugin will regenerate `src/routeTree.gen.ts` on first dev start. (I deleted the stale one to force regeneration.)

### 4. ~~Open up sign-up for JP~~ — done

Sign-up is now open to any email. Added a comment in `auth.tsx` explaining how to gate it later if needed.

### 5. (Optional) Schedule the retention sweep

The migration created `recording_retention_days` and `transcript_retention_days` on user_settings, but the actual sweep job isn't scheduled. To wire it up later, write a Supabase scheduled edge function (or Supabase cron) that runs daily and:

- Deletes audio files older than each user's `recording_retention_days`
- Wipes/anonymizes transcripts older than `transcript_retention_days`

Not blocking — defaults are 90/365 days respectively.

## Known limitations (deliberate scope cuts)

- **Voice transcript fidelity** depends on Gemini Live's input/output transcription. Quality is good but not 100%. The recorded audio file captures only mic input (not AI output) — Web Audio limits make capturing both sides without extra plumbing fiddly. Sufficient for a session log; if you want full bidirectional recording we can add it later.
- **Project builder uses Textarea instead of a rich editor.** I removed TipTap deps to keep the install lean — you can paste markdown, and there's a "Preview rendered" expandable per section. If you want a full WYSIWYG, easy upgrade later.

## What was wired in the second pass (after initial delivery)

- ✅ **Auth opened up** — any email can sign up now. `auth.tsx` no longer gates on a hard-coded email.
- ✅ **Resume text extraction in onboarding** — when you upload a PDF in step 3 of onboarding, `pdfjs-dist` extracts the text and saves it to `profiles.resume_text`. Without this, the AI couldn't reference your background.
- ✅ **Analytics events wired at funnel points** — automatic insert into `analytics_events` on: `profile_completed` (onboarding wizard finish), `job_added` (every new job), `dossier_generated` (every successful insights run), `mock_completed` (every text + voice mock end), `project_exported` (every PPTX/DOCX/HTML export). All non-blocking (errors swallowed).
- ✅ **`/admin/funnel` page** — visualizes the counts as a per-step bar chart so you can see your own progression through the app.
- ✅ **"Rewrite with feedback" button** in the project Drafting tab — opens a dialog for interviewer feedback and rewrites the section preserving voice.

## Smoke tests for when you have time

(In addition to the deferred Bundle A tests in the project doc.)

**Bundle B**

1. Without `GEMINI_API_KEY` set: open mock setup → voice toggle is disabled with explanation. Toggle stays off.
2. With key set: voice toggle is on by default. Start mock → mic permission prompt → live page shows persona avatar pulsing while interviewer speaks.
3. Speak — see your words appear in transcript as candidate. Pause — interviewer responds.
4. Interrupt mid-sentence — interviewer cuts off cleanly.
5. Mute → AI waits → unmute → continue.
6. End → audio uploads to `user-files/{user_id}/sessions/{sessionId}.webm` → debrief generates → debrief page shows audio player at top.

**Bundle C — Project Builder**

1. From a job with a dossier, click Projects → empty state → New project
2. Paste a real take-home brief → extracted brief renders on Brief tab
3. Research tab → Run research → 5-8 grounded findings appear within 60s
4. Outline tab → Generate outline → sections appear matching deliverable type
5. Drafting tab → AI draft on a section → content streams (well, fills) in. Tighten/Expand work.
6. Export → PPTX downloads → opens in Keynote/PowerPoint with cover + section slides
7. Export DOCX → opens in Word/Pages with title + headings
8. Export HTML → opens in browser, Cmd+P → save as PDF

**Bundle C — Polish**

1. Fresh user signup → onboarding wizard appears → walk through → land on /dashboard
2. Settings → Appearance → toggle Light → entire UI switches → persists across reload
3. Settings → Privacy → Download my data → JSON file with everything
4. Settings → Privacy → Delete my account → modal requiring email match → confirmed delete wipes profile + all data + storage
5. Public `/` → unauthed sees landing → click Sign in → /auth → sign in → land on /dashboard
6. /admin/rls-test → as Adam, run check → all green. Sign in as JP → run check → still green and shows JP's data only.

## Architecture notes / things to know

- **Two LLM call paths now**: most work goes through the Lovable AI Gateway (`createLovableAiGatewayProvider`). The dossier generator passes `providerOptions.google.useSearchGrounding: true` for grounding — verify it actually propagates by looking at Recent Moves in a fresh dossier. If grounding isn't working, swap to `@ai-sdk/google` (already in deps) using `process.env.GEMINI_API_KEY` directly for that specific call.
- **Voice path** uses `GEMINI_API_KEY` directly (Lovable AI Gateway is HTTP-only, can't proxy WebSockets).
- **Storage layout** is `user-files/{user_id}/...`. Resume at `resume.pdf`. Sessions at `sessions/{sessionId}.webm`. Project exports stay client-side as direct downloads (no storage round-trip).
- **RLS is enforced everywhere.** Every user-data table has policies. Edge cases to watch: when you regenerate Supabase types after the new migration, the new columns/tables will appear in `Database` types. Until then, server fns use `as never` casts.

## When credits return

Just push the codebase to your Lovable project (or use Lovable's import). The migrations will need to be applied separately via Supabase Dashboard if Lovable doesn't pick them up automatically.

If anything's broken or weird, send the codebase + a description back to me and I'll diagnose.

— Conno
