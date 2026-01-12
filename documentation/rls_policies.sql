-- Hummane API - Row Level Security (RLS) policies (Supabase-friendly)
-- Notes:
-- - Assumes JWT includes company_id claim.
-- - auth.uid() is used for the current user (Supabase auth).
-- - Service role bypasses RLS; test with anon/auth roles.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'company_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT auth.uid();
$$;

-- Enable RLS on tenant tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_entries ENABLE ROW LEVEL SECURITY;

-- Companies: allow owner or company members to read; owner can create/update/delete
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select
ON companies
FOR SELECT
USING (
    id = app.current_company_id()
    OR owner_id = app.current_user_id()
);

DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert
ON companies
FOR INSERT
WITH CHECK (owner_id = app.current_user_id());

DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update
ON companies
FOR UPDATE
USING (owner_id = app.current_user_id())
WITH CHECK (owner_id = app.current_user_id());

DROP POLICY IF EXISTS companies_delete ON companies;
CREATE POLICY companies_delete
ON companies
FOR DELETE
USING (owner_id = app.current_user_id());

-- Users: restrict to same company (or self before company is set)
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select
ON users
FOR SELECT
USING (
    company_id = app.current_company_id()
    OR id = app.current_user_id()
);

DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert
ON users
FOR INSERT
WITH CHECK (
    id = app.current_user_id()
    AND (company_id IS NULL OR company_id = app.current_company_id())
);

DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update
ON users
FOR UPDATE
USING (
    company_id = app.current_company_id()
    OR id = app.current_user_id()
)
WITH CHECK (
    company_id = app.current_company_id()
    OR id = app.current_user_id()
);

DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_delete
ON users
FOR DELETE
USING (company_id = app.current_company_id());

-- User invitations
DROP POLICY IF EXISTS user_invitations_select ON user_invitations;
CREATE POLICY user_invitations_select ON user_invitations
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS user_invitations_insert ON user_invitations;
CREATE POLICY user_invitations_insert ON user_invitations
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS user_invitations_update ON user_invitations;
CREATE POLICY user_invitations_update ON user_invitations
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS user_invitations_delete ON user_invitations;
CREATE POLICY user_invitations_delete ON user_invitations
FOR DELETE USING (company_id = app.current_company_id());

-- Helper macro: company_id scoped policies
-- (Applied per table to keep policy names explicit)

-- Departments
DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS departments_insert ON departments;
CREATE POLICY departments_insert ON departments
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS departments_update ON departments;
CREATE POLICY departments_update ON departments
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS departments_delete ON departments;
CREATE POLICY departments_delete ON departments
FOR DELETE USING (company_id = app.current_company_id());

-- Roles
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS roles_insert ON roles;
CREATE POLICY roles_insert ON roles
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS roles_update ON roles;
CREATE POLICY roles_update ON roles
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS roles_delete ON roles;
CREATE POLICY roles_delete ON roles
FOR DELETE USING (company_id = app.current_company_id());

-- Employees
DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS employees_insert ON employees;
CREATE POLICY employees_insert ON employees
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees
FOR DELETE USING (company_id = app.current_company_id());

-- Employee documents
DROP POLICY IF EXISTS employee_documents_select ON employee_documents;
CREATE POLICY employee_documents_select ON employee_documents
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS employee_documents_insert ON employee_documents;
CREATE POLICY employee_documents_insert ON employee_documents
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS employee_documents_update ON employee_documents;
CREATE POLICY employee_documents_update ON employee_documents
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS employee_documents_delete ON employee_documents;
CREATE POLICY employee_documents_delete ON employee_documents
FOR DELETE USING (company_id = app.current_company_id());

-- Jobs
DROP POLICY IF EXISTS jobs_select ON jobs;
CREATE POLICY jobs_select ON jobs
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS jobs_insert ON jobs;
CREATE POLICY jobs_insert ON jobs
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS jobs_update ON jobs;
CREATE POLICY jobs_update ON jobs
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS jobs_delete ON jobs;
CREATE POLICY jobs_delete ON jobs
FOR DELETE USING (company_id = app.current_company_id());

-- Applicants
DROP POLICY IF EXISTS applicants_select ON applicants;
CREATE POLICY applicants_select ON applicants
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS applicants_insert ON applicants;
CREATE POLICY applicants_insert ON applicants
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS applicants_update ON applicants;
CREATE POLICY applicants_update ON applicants
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS applicants_delete ON applicants;
CREATE POLICY applicants_delete ON applicants
FOR DELETE USING (company_id = app.current_company_id());

-- Leave types
DROP POLICY IF EXISTS leave_types_select ON leave_types;
CREATE POLICY leave_types_select ON leave_types
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_types_insert ON leave_types;
CREATE POLICY leave_types_insert ON leave_types
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_types_update ON leave_types;
CREATE POLICY leave_types_update ON leave_types
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_types_delete ON leave_types;
CREATE POLICY leave_types_delete ON leave_types
FOR DELETE USING (company_id = app.current_company_id());

-- Leave records
DROP POLICY IF EXISTS leave_records_select ON leave_records;
CREATE POLICY leave_records_select ON leave_records
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_records_insert ON leave_records;
CREATE POLICY leave_records_insert ON leave_records
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_records_update ON leave_records;
CREATE POLICY leave_records_update ON leave_records
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_records_delete ON leave_records;
CREATE POLICY leave_records_delete ON leave_records
FOR DELETE USING (company_id = app.current_company_id());

-- Leave days
DROP POLICY IF EXISTS leave_days_select ON leave_days;
CREATE POLICY leave_days_select ON leave_days
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_days_insert ON leave_days;
CREATE POLICY leave_days_insert ON leave_days
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_days_update ON leave_days;
CREATE POLICY leave_days_update ON leave_days
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS leave_days_delete ON leave_days;
CREATE POLICY leave_days_delete ON leave_days
FOR DELETE USING (company_id = app.current_company_id());

-- Holidays
DROP POLICY IF EXISTS holidays_select ON holidays;
CREATE POLICY holidays_select ON holidays
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS holidays_insert ON holidays;
CREATE POLICY holidays_insert ON holidays
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS holidays_update ON holidays;
CREATE POLICY holidays_update ON holidays
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS holidays_delete ON holidays;
CREATE POLICY holidays_delete ON holidays
FOR DELETE USING (company_id = app.current_company_id());

-- Feedback cards
DROP POLICY IF EXISTS feedback_cards_select ON feedback_cards;
CREATE POLICY feedback_cards_select ON feedback_cards
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_cards_insert ON feedback_cards;
CREATE POLICY feedback_cards_insert ON feedback_cards
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_cards_update ON feedback_cards;
CREATE POLICY feedback_cards_update ON feedback_cards
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_cards_delete ON feedback_cards;
CREATE POLICY feedback_cards_delete ON feedback_cards
FOR DELETE USING (company_id = app.current_company_id());

-- Feedback entries
DROP POLICY IF EXISTS feedback_entries_select ON feedback_entries;
CREATE POLICY feedback_entries_select ON feedback_entries
FOR SELECT USING (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_entries_insert ON feedback_entries;
CREATE POLICY feedback_entries_insert ON feedback_entries
FOR INSERT WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_entries_update ON feedback_entries;
CREATE POLICY feedback_entries_update ON feedback_entries
FOR UPDATE USING (company_id = app.current_company_id())
WITH CHECK (company_id = app.current_company_id());
DROP POLICY IF EXISTS feedback_entries_delete ON feedback_entries;
CREATE POLICY feedback_entries_delete ON feedback_entries
FOR DELETE USING (company_id = app.current_company_id());

COMMIT;
