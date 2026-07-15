-- Migration: resources and vendors
-- Run this in the Supabase SQL editor. Safe to re-run (idempotent).

BEGIN;

-- Vendors: lightweight supplier / merchant directory (company-scoped)
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Resources: one register for assets, subscriptions, services, expenses,
-- events and reimbursements (company-scoped)
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  vendor_id uuid,
  resource_type text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  identifier text,
  status text NOT NULL DEFAULT 'active',
  assignment_type text NOT NULL DEFAULT 'not_applicable',
  assigned_to_employee_id uuid,
  location text,
  assigned_at timestamptz,
  assignment_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_amount numeric(12, 2),
  cost_type text,
  expense_date date,
  paid_by_employee_id uuid,
  is_settled boolean NOT NULL DEFAULT true,
  attachments jsonb NOT NULL DEFAULT '{"files": []}'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys (guarded so the migration can be re-run safely)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_company_fk') THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_company_fk
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_company_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_company_fk
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_vendor_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_vendor_fk
      FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_assigned_employee_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_assigned_employee_fk
      FOREIGN KEY (assigned_to_employee_id) REFERENCES employees (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resources_paid_by_employee_fk') THEN
    ALTER TABLE resources ADD CONSTRAINT resources_paid_by_employee_fk
      FOREIGN KEY (paid_by_employee_id) REFERENCES employees (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_company_name
  ON vendors (company_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON vendors (company_id);

CREATE INDEX IF NOT EXISTS idx_resources_company_id ON resources (company_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (company_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources (company_id, status);
CREATE INDEX IF NOT EXISTS idx_resources_assignee
  ON resources (company_id, assigned_to_employee_id);
CREATE INDEX IF NOT EXISTS idx_resources_vendor_id ON resources (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_company_identifier
  ON resources (company_id, identifier)
  WHERE identifier IS NOT NULL;

COMMIT;
