ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS requirements text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS responsibilities text[] DEFAULT '{}'::text[];

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS interview_type text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS target_duration_minutes int,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'text';

ALTER TABLE public.interview_sessions
  ALTER COLUMN persona TYPE jsonb USING (
    CASE
      WHEN persona IS NULL THEN NULL
      WHEN pg_typeof(persona)::text = 'jsonb' THEN persona::jsonb
      ELSE jsonb_build_object('title', persona::text, 'seniority', '', 'style', '')
    END
  );