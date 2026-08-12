-- Migration: typed staffing resource requests
-- Safe to re-run (idempotent).

BEGIN;

ALTER TABLE resource_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'resource',
  ADD COLUMN IF NOT EXISTS staffing_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_resource_requests_company_type
  ON resource_requests (company_id, request_type, created_at DESC);

COMMIT;