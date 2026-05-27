ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS insights_one_current_per_job
  ON public.insights (job_id) WHERE is_current;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_input text;