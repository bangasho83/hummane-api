# Hummane API

NestJS and PostgreSQL API for Hummane's HR and collaboration portal.

## Current Task System

The task system is company-scoped and uses two core tables plus project membership:

- `task_projects` — projects, optional parent projects, archive state, and project metadata.
- `tasks` — tasks and subtasks. Subtasks use `parent_task_id`; comments and labels are JSONB arrays.
- `task_project_members` — employee membership for each project.

Run migrations in this order in Supabase:

1. `documentation/migrations/2026-09-27_tasks.sql`
2. `documentation/migrations/2026-10-04_task_project_members.sql`

The membership migration adds archive support, creates the membership table, and initially adds existing company employees to existing projects. New project creators become members automatically. Assigning an employee to a task also adds that employee to the project.

## Task Endpoints

All task endpoints require `Authorization: Bearer <JWT>` and are scoped to the authenticated employee's company and project memberships.

### Projects

- `GET /task-projects` — list active projects the employee belongs to.
- `POST /task-projects` — create a project; the creator becomes a member.
- `GET /task-projects/:id` — get a member's project.
- `PATCH /task-projects/:id` — edit a member's project.
- `DELETE /task-projects/:id` — archive a member's project; it is not physically deleted.
- `GET /task-projects/:id/members` — list members.
- `POST /task-projects/:id/members/:employeeId` — add a company employee.
- `DELETE /task-projects/:id/members/:employeeId` — remove a member. A member cannot remove themselves.

### Tasks

- `GET /tasks?scope=all|my&projectId=<uuid>&status=<status>&search=<text>`
- `POST /tasks` — create a task or subtask with `parentTaskId`.
- `GET /tasks/:id` — get a task with subtask summaries and comments.
- `PATCH /tasks/:id` — update task content, status, priority, assignee, dates, labels, or parent.
- `POST /tasks/:id/comments` — append a comment with the author's employee name.

## Development

```bash
npm ci
npm run build
npm test
npm run start:dev
```

Do not deploy with the Vercel CLI. The repository is connected to Vercel; pushing to `main` triggers the production deployment.

See `documentation/endpoints.md` for the broader API reference and cURL examples.
