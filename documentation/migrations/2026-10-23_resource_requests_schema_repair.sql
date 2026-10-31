-- Resource request schema repair
-- Run this in Supabase SQL Editor before deploying the corresponding API update.
-- Safe to run more than once. It supports databases created before typed staffing requests.

BEGIN;

ALTER TABLE resource_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'resource',
  ADD COLUMN IF NOT EXISTS staffing_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS employee_email text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Normalize legacy/null values so every existing row conforms to the API contract.
UPDATE resource_requests
SET
  request_type = COALESCE(NULLIF(request_type, ''), 'resource'),
  staffing_details = COALESCE(staffing_details, '{}'::jsonb),
  status_history = COALESCE(status_history, '[]'::jsonb),
  updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE resource_requests
  DROP CONSTRAINT IF EXISTS resource_requests_request_type_check;

ALTER TABLE resource_requests
  ADD CONSTRAINT resource_requests_request_type_check
  CHECK (request_type IN ('resource', 'headcount', 'team_allocation'));

CREATE INDEX IF NOT EXISTS idx_resource_requests_company_type
  ON resource_requests (company_id, request_type, created_at DESC);

COMMIT;
