-- Bundle B + C migrations
-- Bundle B (Voice): no schema changes needed — `mode` column already on interview_sessions
-- Bundle C (Projects + Polish): extend projects table, add project_artifacts, user_settings, analytics_events

-- =============================================================
-- PROJECTS
-- =============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS extracted_brief jsonb,
  ADD COLUMN IF NOT EXISTS outline jsonb,
  ADD COLUMN IF NOT EXISTS research_notes jsonb,
  ADD COLUMN IF NOT EXISTS last_exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_export_format text;

CREATE TABLE IF NOT EXISTS public.project_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  format text NOT NULL,
  file_url text,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "artifacts own select" ON public.project_artifacts;
DROP POLICY IF EXISTS "artifacts own insert" ON public.project_artifacts;
DROP POLICY IF EXISTS "artifacts own update" ON public.project_artifacts;
DROP POLICY IF EXISTS "artifacts own delete" ON public.project_artifacts;
CREATE POLICY "artifacts own select" ON public.project_artifacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "artifacts own insert" ON public.project_artifacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artifacts own update" ON public.project_artifacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "artifacts own delete" ON public.project_artifacts FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- USER SETTINGS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark',
  accent_color text NOT NULL DEFAULT '#d97706',
  recording_retention_days int NOT NULL DEFAULT 90,
  transcript_retention_days int NOT NULL DEFAULT 365,
  email_notifications boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings own all" ON public.user_settings;
CREATE POLICY "settings own all" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_user_settings_updated ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend signup trigger to also create user_settings row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- Backfill user_settings for existing users
INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================
-- ANALYTICS EVENTS
-- =============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  properties jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytics own select" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics own insert" ON public.analytics_events;
CREATE POLICY "analytics own select" ON public.analytics_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analytics own insert" ON public.analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS analytics_events_user_event_idx
  ON public.analytics_events (user_id, event_name, created_at DESC);
