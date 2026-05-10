-- Add personal_request to projects: a candidate-supplied strategic lens
-- that threads through AI research, outline generation, and section drafting.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS personal_request TEXT;
