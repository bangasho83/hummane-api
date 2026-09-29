-- Hummane Tasks
-- Run this migration in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS task_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_project_id uuid REFERENCES task_projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#2563eb',
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_projects_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT task_projects_not_own_parent CHECK (parent_project_id IS NULL OR parent_project_id <> id)
);

INSERT INTO task_projects (company_id, name, description, color)
SELECT c.id, defaults.name, defaults.description, defaults.color
FROM companies c
CROSS JOIN (VALUES
  ('Website refresh', 'A clearer, calmer home for Hummane.', '#2563eb'),
  ('New team onboarding', 'Make the first week feel welcoming and simple.', '#10b981'),
  ('Office setup', 'The practical things that help everyone do good work.', '#f59e0b')
) AS defaults(name, description, color)
WHERE NOT EXISTS (
  SELECT 1 FROM task_projects p WHERE p.company_id = c.id AND p.name = defaults.name
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES task_projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'normal',
  assignee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  due_date date,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT tasks_labels_array_check CHECK (jsonb_typeof(labels) = 'array'),
  CONSTRAINT tasks_comments_array_check CHECK (jsonb_typeof(comments) = 'array'),
  CONSTRAINT tasks_not_own_parent CHECK (parent_task_id IS NULL OR parent_task_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_task_projects_company_id ON task_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_task_projects_parent_id ON task_projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(company_id, due_date);

-- Enforce tenant-safe project/task relationships at the database level.
CREATE OR REPLACE FUNCTION validate_task_project_company()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_projects WHERE id = NEW.project_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Task project must belong to the same company';
  END IF;
  IF NEW.parent_task_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Parent task must belong to the same company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_task_project_company ON tasks;
CREATE TRIGGER trg_validate_task_project_company
BEFORE INSERT OR UPDATE OF company_id, project_id, parent_task_id ON tasks
FOR EACH ROW EXECUTE FUNCTION validate_task_project_company();

CREATE OR REPLACE FUNCTION validate_task_project_parent_company()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_projects WHERE id = NEW.parent_project_id AND company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'Parent project must belong to the same company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_task_project_parent_company ON task_projects;
CREATE TRIGGER trg_validate_task_project_parent_company
BEFORE INSERT OR UPDATE OF company_id, parent_project_id ON task_projects
FOR EACH ROW EXECUTE FUNCTION validate_task_project_parent_company();
