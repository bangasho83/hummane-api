-- Migration: collaborative company OKR cycles.
-- Safe to re-run in the Supabase SQL editor.

BEGIN;

CREATE TABLE IF NOT EXISTS okr_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  headline text NOT NULL DEFAULT '',
  description text,
  target_value numeric(12, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '',
  target_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  level text NOT NULL CHECK (level IN ('team', 'individual')),
  parent_objective_id uuid,
  department_id uuid,
  employee_id uuid,
  headline text NOT NULL DEFAULT '',
  description text,
  current_value numeric(12, 2) NOT NULL DEFAULT 0,
  target_value numeric(12, 2) NOT NULL DEFAULT 1 CHECK (target_value > 0),
  unit text NOT NULL DEFAULT '',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  progress_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT okr_objectives_level_owner_check CHECK (
    (level = 'team' AND department_id IS NOT NULL AND employee_id IS NULL)
    OR (level = 'individual' AND employee_id IS NOT NULL AND department_id IS NULL)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_cycles_company_fk') THEN
    ALTER TABLE okr_cycles ADD CONSTRAINT okr_cycles_company_fk
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_objectives_company_fk') THEN
    ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_company_fk
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_objectives_cycle_fk') THEN
    ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_cycle_fk
      FOREIGN KEY (cycle_id) REFERENCES okr_cycles (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_objectives_parent_fk') THEN
    ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_parent_fk
      FOREIGN KEY (parent_objective_id) REFERENCES okr_objectives (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_objectives_department_fk') THEN
    ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_department_fk
      FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'okr_objectives_employee_fk') THEN
    ALTER TABLE okr_objectives ADD CONSTRAINT okr_objectives_employee_fk
      FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_okr_cycles_company_status ON okr_cycles (company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_okr_cycles_one_active_per_company
  ON okr_cycles (company_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_okr_objectives_cycle ON okr_objectives (company_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_department ON okr_objectives (company_id, department_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_employee ON okr_objectives (company_id, employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_okr_team_objective_per_cycle
  ON okr_objectives (cycle_id, department_id) WHERE level = 'team';
CREATE UNIQUE INDEX IF NOT EXISTS idx_okr_individual_objective_per_cycle
  ON okr_objectives (cycle_id, employee_id) WHERE level = 'individual';

COMMIT;
