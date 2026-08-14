-- Migration: team objectives are descriptive roll-up nodes.
-- Run after 2026-08-14_okrs.sql.

BEGIN;

ALTER TABLE okr_objectives
  ALTER COLUMN current_value DROP NOT NULL,
  ALTER COLUMN target_value DROP NOT NULL,
  ALTER COLUMN unit DROP NOT NULL,
  ALTER COLUMN due_date DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL;

ALTER TABLE okr_objectives
  ALTER COLUMN current_value DROP DEFAULT,
  ALTER COLUMN target_value DROP DEFAULT,
  ALTER COLUMN unit DROP DEFAULT,
  ALTER COLUMN status DROP DEFAULT;

-- Remove obsolete manually-entered values from existing team objectives.
UPDATE okr_objectives
SET current_value = NULL,
    target_value = NULL,
    unit = NULL,
    due_date = NULL,
    status = NULL,
    progress_history = '[]'::jsonb
WHERE level = 'team';

-- Individual objectives always retain their measurable result fields.
ALTER TABLE okr_objectives
  DROP CONSTRAINT IF EXISTS okr_objectives_level_owner_check;

ALTER TABLE okr_objectives
  ADD CONSTRAINT okr_objectives_level_owner_check CHECK (
    (level = 'team'
      AND department_id IS NOT NULL
      AND employee_id IS NULL
      AND parent_objective_id IS NULL
      AND current_value IS NULL
      AND target_value IS NULL
      AND unit IS NULL
      AND due_date IS NULL
      AND status IS NULL)
    OR
    (level = 'individual'
      AND employee_id IS NOT NULL
      AND department_id IS NULL
      AND parent_objective_id IS NOT NULL
      AND current_value IS NOT NULL
      AND target_value IS NOT NULL
      AND target_value > 0
      AND unit IS NOT NULL
      AND due_date IS NOT NULL
      AND status IS NOT NULL)
  );

COMMIT;
