-- Hummane project membership
-- Run after 2026-09-27_tasks.sql in Supabase SQL Editor.

ALTER TABLE task_projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS task_project_members (
  project_id uuid NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_task_project_members_employee_id
  ON task_project_members(employee_id);

CREATE INDEX IF NOT EXISTS idx_task_project_members_project_id
  ON task_project_members(project_id);

-- Existing projects are initially available to all current employees in the same company.
INSERT INTO task_project_members (project_id, employee_id)
SELECT p.id, e.id
FROM task_projects p
JOIN employees e ON e.company_id = p.company_id
ON CONFLICT (project_id, employee_id) DO NOTHING;
