# Hummane API System Flow

## Overview
The API uses Firebase only for authentication and stores all business data in Supabase Postgres. Each request is tenant-scoped by `companyId` from the JWT, and services enforce company isolation on every query.

## Auth + Session
1) Client signs in with Firebase and receives a Firebase ID token.
2) Client calls `POST /auth/login` with the Firebase token.
3) Server verifies the Firebase token, finds or creates a `users` row in Postgres.
4) Server issues a JWT with `{ sub, email, companyId }`.
5) Client uses the JWT for all subsequent requests.

## Company Setup
1) The first authenticated user calls `POST /companies`.
2) The company is created in Postgres with `owner_id = user.id`.
3) The user record is linked to the company (`users.company_id`).
4) Future requests read `companyId` from the JWT and scope all data.

## Tenant Enforcement
- Controllers set `companyId` from the JWT before validation.
- Services query `... WHERE company_id = $companyId`.
- Updates/deletes also check `company_id` in the WHERE clause.

## Invitations
1) Admin creates an employee record with the invitee’s email.
2) Admin calls `POST /invitations` with `email` and optional `employeeId`.
3) Server stores invite metadata in `user_invitations` and returns `inviteToken`.
4) Invitee accepts and logs in; the app links `employees.user_id`.

## Core CRUD
- Users: read/write profiles tied to the tenant.
- Departments/Roles/Jobs: created per company and referenced by IDs.
- Employees: linked to departments/roles and optionally a user account.
- Documents: stored in `employee_documents` with `employee_id` and `company_id`.
- Applicants: stored per company with optional `job_id` and document links.

## Leave Processing
1) `POST /leaves` creates a leave record with date range and unit.
2) The service expands the range into `leave_days` rows.
3) Each day is flagged using company working hours and holidays:
   - `is_working_day`, `is_holiday`, `is_closed`
   - `counts_toward_quota` is true only for working days.
4) For `Day` unit, the API computes total `amount` as the count of working days.
5) Updates that change date/unit/amount rebuild leave days.

## Holidays + Working Hours
- Company working hours are stored in `companies.working_hours`.
- Holidays are stored in `holidays` and used to compute leave day flags.

## Feedback
- Feedback cards store templates (`feedback_cards`).
- Feedback entries store submissions (`feedback_entries`) with `subject_type` and `subject_id`.

## Validation and Data Types
- API validates payloads using Zod before persisting.
- Amounts allow 2 decimal places; years of experience allows 1 decimal place.
- Enum-like fields are stored as text for flexibility.

## Data Stores
- Auth: Firebase (token verification only).
- Data: Supabase Postgres (all CRUD and relationships).
