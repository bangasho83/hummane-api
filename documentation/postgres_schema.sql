-- Hummane API - Postgres schema
-- Notes:
-- - Enum-like fields are stored as TEXT for future flexibility.
-- - created_at/updated_at use timestamptz.
-- - JSON fields use jsonb.
-- Tables:
-- - companies
-- - users
-- - user_invitations
-- - departments
-- - roles
-- - employees
-- - employee_documents
-- - jobs
-- - applicants
-- - leave_types
-- - leave_records
-- - leave_days
-- - holidays
-- - feedback_cards
-- - feedback_entries

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  industry text,
  size text,
  currency text,
  timezone text,
  working_hours jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  employee_id uuid,
  status text NOT NULL DEFAULT 'pending',
  token_hash text,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  company_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  department_id uuid,
  role_id uuid,
  start_date date NOT NULL,
  employment_type text NOT NULL,
  employment_mode text,
  reporting_manager_id uuid,
  gender text NOT NULL,
  salary numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id)
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  name text NOT NULL,
  document_kind text NOT NULL,
  data_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  role_id uuid,
  department_id uuid,
  employment_type text,
  employment_mode text,
  location text,
  salary_from integer,
  salary_to integer,
  experience text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  position_applied text,
  years_of_experience numeric(4, 1),
  current_salary integer,
  expected_salary integer,
  notice_period text,
  resume_file text,
  linkedin_url text,
  status text NOT NULL,
  applied_date date NOT NULL,
  documents jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  unit text NOT NULL,
  quota numeric(12, 2) NOT NULL,
  employment_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_type_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  unit text NOT NULL,
  amount numeric(12, 2),
  note text,
  documents jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS leave_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_record_id uuid NOT NULL,
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_type_id uuid,
  date date NOT NULL,
  day_of_week text NOT NULL,
  unit text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  is_working_day boolean NOT NULL,
  is_holiday boolean NOT NULL,
  is_closed boolean NOT NULL,
  counts_toward_quota boolean NOT NULL,
  working_hours jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_record_id, date)
);

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  date date NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  card_id uuid NOT NULL,
  type text,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  subject_name text,
  author_id uuid,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign keys (added after tables to avoid dependency ordering)
ALTER TABLE companies
  ADD CONSTRAINT companies_owner_fk
  FOREIGN KEY (owner_id) REFERENCES users (id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE users
  ADD CONSTRAINT users_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE user_invitations
  ADD CONSTRAINT user_invitations_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT user_invitations_invited_by_fk
  FOREIGN KEY (invited_by) REFERENCES users (id),
  ADD CONSTRAINT user_invitations_employee_fk
  FOREIGN KEY (employee_id) REFERENCES employees (id);

ALTER TABLE departments
  ADD CONSTRAINT departments_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE roles
  ADD CONSTRAINT roles_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE employees
  ADD CONSTRAINT employees_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT employees_user_fk
  FOREIGN KEY (user_id) REFERENCES users (id),
  ADD CONSTRAINT employees_role_fk
  FOREIGN KEY (role_id) REFERENCES roles (id),
  ADD CONSTRAINT employees_department_fk
  FOREIGN KEY (department_id) REFERENCES departments (id),
  ADD CONSTRAINT employees_reporting_manager_fk
  FOREIGN KEY (reporting_manager_id) REFERENCES employees (id);

ALTER TABLE employee_documents
  ADD CONSTRAINT employee_documents_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT employee_documents_employee_fk
  FOREIGN KEY (employee_id) REFERENCES employees (id);

ALTER TABLE jobs
  ADD CONSTRAINT jobs_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT jobs_role_fk
  FOREIGN KEY (role_id) REFERENCES roles (id),
  ADD CONSTRAINT jobs_department_fk
  FOREIGN KEY (department_id) REFERENCES departments (id);

ALTER TABLE applicants
  ADD CONSTRAINT applicants_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT applicants_job_fk
  FOREIGN KEY (job_id) REFERENCES jobs (id);

ALTER TABLE leave_types
  ADD CONSTRAINT leave_types_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE leave_records
  ADD CONSTRAINT leave_records_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT leave_records_employee_fk
  FOREIGN KEY (employee_id) REFERENCES employees (id),
  ADD CONSTRAINT leave_records_leave_type_fk
  FOREIGN KEY (leave_type_id) REFERENCES leave_types (id);

ALTER TABLE leave_days
  ADD CONSTRAINT leave_days_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT leave_days_employee_fk
  FOREIGN KEY (employee_id) REFERENCES employees (id),
  ADD CONSTRAINT leave_days_leave_type_fk
  FOREIGN KEY (leave_type_id) REFERENCES leave_types (id),
  ADD CONSTRAINT leave_days_leave_record_fk
  FOREIGN KEY (leave_record_id) REFERENCES leave_records (id);

ALTER TABLE holidays
  ADD CONSTRAINT holidays_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE feedback_cards
  ADD CONSTRAINT feedback_cards_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id);

ALTER TABLE feedback_entries
  ADD CONSTRAINT feedback_entries_company_fk
  FOREIGN KEY (company_id) REFERENCES companies (id),
  ADD CONSTRAINT feedback_entries_card_fk
  FOREIGN KEY (card_id) REFERENCES feedback_cards (id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users (company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company_id ON user_invitations (company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company_email ON user_invitations (company_id, email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company_status ON user_invitations (company_id, status);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments (company_id);
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles (company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees (company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON employees (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager_id ON employees (reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_company_id ON employee_documents (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_department_id ON jobs (department_id);
CREATE INDEX IF NOT EXISTS idx_applicants_company_id ON applicants (company_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_company_id ON leave_types (company_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_company_id ON leave_records (company_id);
CREATE INDEX IF NOT EXISTS idx_leave_days_company_id ON leave_days (company_id);
CREATE INDEX IF NOT EXISTS idx_leave_days_leave_record_id ON leave_days (leave_record_id);
CREATE INDEX IF NOT EXISTS idx_holidays_company_id ON holidays (company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_cards_company_id ON feedback_cards (company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entries_company_id ON feedback_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_entries_subject ON feedback_entries (subject_type, subject_id);

COMMIT;
