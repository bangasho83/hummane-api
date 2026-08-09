-- Migration: reusable resource templates
-- Safe to re-run (idempotent).

BEGIN;

CREATE TABLE IF NOT EXISTS resource_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  resource_type text NOT NULL DEFAULT 'subscription',
  category text NOT NULL,
  description text,
  vendor_id uuid,
  default_cost_amount numeric(12, 2),
  default_cost_type text NOT NULL DEFAULT 'recurring',
  default_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_templates_company_fk') THEN
    ALTER TABLE resource_templates ADD CONSTRAINT resource_templates_company_fk
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resource_templates_vendor_fk') THEN
    ALTER TABLE resource_templates ADD CONSTRAINT resource_templates_vendor_fk
      FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_template_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_template_fk
      FOREIGN KEY (resource_template_id) REFERENCES resource_templates (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resources_template_id
  ON resources (company_id, resource_template_id);
CREATE INDEX IF NOT EXISTS idx_resource_templates_company_id
  ON resource_templates (company_id);
CREATE INDEX IF NOT EXISTS idx_resource_templates_active
  ON resource_templates (company_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_templates_company_name
  ON resource_templates (company_id, lower(name))
  WHERE is_active = true;

COMMIT;