-- Migration: ATS Scanner column on insights
-- Adds the ats_scan JSONB column to store the result of an ATS resume analysis
-- for a given insight row. Additive only — safe to run against production without
-- downtime. Existing rows will have ats_scan = NULL until a scan is triggered.

ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS ats_scan jsonb;

-- Optional index: enables fast "has this job already been scanned?" existence checks
-- without a full table scan. The partial predicate keeps the index small.
CREATE INDEX IF NOT EXISTS insights_ats_scan_not_null_idx
  ON public.insights (job_id)
  WHERE ats_scan IS NOT NULL;
