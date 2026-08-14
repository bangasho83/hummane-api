-- Migration: store measurable key results on individual objectives.
-- Run after 2026-08-15_team_okr_rollups.sql.

BEGIN;

ALTER TABLE okr_objectives
  ADD COLUMN IF NOT EXISTS key_results jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE okr_objectives
  DROP CONSTRAINT IF EXISTS okr_objectives_level_owner_check;

-- Individual progress now comes from key_results rather than a single objective metric.
-- Existing individual rows retain their legacy metric values so their historical progress remains readable.
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
      AND parent_objective_id IS NOT NULL)
  );

COMMIT;
