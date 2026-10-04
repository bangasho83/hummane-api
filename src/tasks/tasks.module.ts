import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { PostgresService } from '../postgres/postgres.service';

const TaskStatus = z.enum(['todo', 'in_progress', 'blocked', 'done']);
const TaskPriority = z.enum(['low', 'normal', 'high', 'urgent']);
const ProjectSchema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(2000).optional().default(''), color: z.string().trim().max(32).optional().default('#2563eb'), parentProjectId: z.string().uuid().nullable().optional() });
const TaskSchema = z.object({ projectId: z.string().uuid(), parentTaskId: z.string().uuid().nullable().optional(), title: z.string().trim().min(1).max(240), description: z.string().trim().max(10000).optional().default(''), status: TaskStatus.optional().default('todo'), priority: TaskPriority.optional().default('normal'), assigneeId: z.string().uuid().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), labels: z.array(z.string().trim().min(1).max(80)).max(20).optional().default([]) });
const UpdateTaskSchema = TaskSchema.partial();
const CommentSchema = z.object({ body: z.string().trim().min(1).max(5000) });

type UserRequest = { user: { companyId: string; employeeId?: string } };

const projectFields = `p.id, p.company_id AS "companyId", p.parent_project_id AS "parentProjectId", p.name, p.description, p.color, p.created_by AS "createdBy", p.archived_at AS "archivedAt", p.created_at AS "createdAt", p.updated_at AS "updatedAt", (SELECT count(*)::int FROM task_project_members pmc WHERE pmc.project_id = p.id) AS "memberCount"`;
const taskFields = `t.id, t.company_id AS "companyId", t.project_id AS "projectId", p.name AS "projectName", p.color AS "projectColor", t.parent_task_id AS "parentTaskId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", COALESCE(a.name, 'Unassigned') AS assignee, t.due_date AS "dueDate", t.labels, t.comments, t.created_by AS "createdBy", t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;

@Injectable()
export class TasksService {
    constructor(private readonly postgres: PostgresService) {}

    async listProjects(companyId: string, employeeId: string | undefined) {
        if (!employeeId) return [];
        const result = await this.postgres.query(`SELECT ${projectFields} FROM task_projects p JOIN task_project_members pm ON pm.project_id = p.id AND pm.employee_id = $2 WHERE p.company_id = $1 AND p.archived_at IS NULL ORDER BY p.name`, [companyId, employeeId]);
        return result.rows;
    }

    async createProject(companyId: string, userId: string | undefined, data: unknown) {
        const parsed = ProjectSchema.safeParse(data);
        if (!parsed.success) throw new BadRequestException(parsed.error.issues);
        if (!userId) throw new BadRequestException('An employee is required to create a project');
        const value = parsed.data;
        if (value.parentProjectId) await this.assertProject(value.parentProjectId, companyId, userId);
        const id = uuidv4();
        await this.postgres.withTransaction(async client => {
            await client.query(`INSERT INTO task_projects (id, company_id, parent_project_id, name, description, color, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, companyId, value.parentProjectId ?? null, value.name, value.description, value.color, userId]);
            await client.query('INSERT INTO task_project_members (project_id, employee_id) VALUES ($1, $2)', [id, userId]);
        });
        return this.getProject(id, companyId, userId);
    }

    async getProject(id: string, companyId: string, employeeId?: string) {
        if (employeeId) await this.assertProject(id, companyId, employeeId);
        const result = await this.postgres.query(`SELECT ${projectFields} FROM task_projects p WHERE p.id = $1 AND p.company_id = $2 AND p.archived_at IS NULL`, [id, companyId]);
        return result.rows[0] ?? null;
    }

    async updateProject(id: string, companyId: string, employeeId: string | undefined, data: unknown) {
        const parsed = ProjectSchema.partial().safeParse(data);
        if (!parsed.success) throw new BadRequestException(parsed.error.issues);
        if (!employeeId) throw new BadRequestException('An employee is required to update a project');
        await this.assertProject(id, companyId, employeeId);
        const value = parsed.data;
        if (value.parentProjectId === id) throw new BadRequestException('A project cannot be its own parent');
        if (value.parentProjectId) await this.assertProject(value.parentProjectId, companyId, employeeId);
        const columns: string[] = [];
        const params: unknown[] = [];
        for (const [key, column] of Object.entries({ parentProjectId: 'parent_project_id', name: 'name', description: 'description', color: 'color' })) {
            if (key in value) { columns.push(`${column} = $${params.length + 1}`); params.push((value as Record<string, unknown>)[key]); }
        }
        if (!columns.length) return this.getProject(id, companyId, employeeId);
        params.push(id, companyId);
        const result = await this.postgres.query<{ id: string }>(`UPDATE task_projects SET ${columns.join(', ')}, updated_at = now() WHERE id = $${params.length - 1} AND company_id = $${params.length} AND archived_at IS NULL RETURNING id`, params);
        return result.rows[0] ? this.getProject(result.rows[0].id, companyId, employeeId) : null;
    }

    async archiveProject(id: string, companyId: string, employeeId: string | undefined) {
        if (!employeeId) throw new BadRequestException('An employee is required to archive a project');
        await this.assertProject(id, companyId, employeeId);
        const result = await this.postgres.query('UPDATE task_projects SET archived_at = now(), updated_at = now() WHERE id = $1 AND company_id = $2 AND archived_at IS NULL RETURNING id', [id, companyId]);
        return { archived: Boolean(result.rowCount) };
    }

    async listProjectMembers(id: string, companyId: string, employeeId: string | undefined) {
        if (!employeeId) return [];
        await this.assertProject(id, companyId, employeeId);
        const result = await this.postgres.query(`SELECT e.id, e.name, e.email FROM task_project_members pm JOIN employees e ON e.id = pm.employee_id WHERE pm.project_id = $1 AND e.company_id = $2 ORDER BY e.name`, [id, companyId]);
        return result.rows;
    }

    async addProjectMember(id: string, companyId: string, actorId: string | undefined, memberId: string) {
        if (!actorId) throw new BadRequestException('An employee is required');
        await this.assertProject(id, companyId, actorId);
        await this.assertEmployee(memberId, companyId);
        await this.postgres.query('INSERT INTO task_project_members (project_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, memberId]);
        return this.listProjectMembers(id, companyId, actorId);
    }

    async removeProjectMember(id: string, companyId: string, actorId: string | undefined, memberId: string) {
        if (!actorId) throw new BadRequestException('An employee is required');
        await this.assertProject(id, companyId, actorId);
        if (actorId === memberId) throw new BadRequestException('You cannot remove yourself from a project');
        await this.postgres.query('DELETE FROM task_project_members WHERE project_id = $1 AND employee_id = $2', [id, memberId]);
        return this.listProjectMembers(id, companyId, actorId);
    }

    async listTasks(companyId: string, employeeId: string | undefined, query: { scope?: string; projectId?: string; status?: string; search?: string }) {
        const params: unknown[] = [companyId];
        const where = ['t.company_id = $1'];
        if (query.scope === 'my') {
            if (!employeeId) return [];
            params.push(employeeId);
            where.push(`t.assignee_id = $${params.length}`);
        }
        if (query.projectId && query.projectId !== 'all') { params.push(query.projectId); where.push(`t.project_id = $${params.length}`); }
        if (query.status && query.status !== 'all') { params.push(query.status); where.push(`t.status = $${params.length}`); }
        if (query.search?.trim()) { params.push(`%${query.search.trim()}%`); where.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`); }
        const result = await this.postgres.query(`SELECT ${taskFields} FROM tasks t LEFT JOIN employees a ON a.id = t.assignee_id LEFT JOIN task_projects p ON p.id = t.project_id WHERE ${where.join(' AND ')} ORDER BY t.due_date NULLS LAST, t.created_at DESC`, params);
        return this.withSubtasks(result.rows, companyId);
    }

    async getTask(id: string, companyId: string) {
        const result = await this.postgres.query(`SELECT ${taskFields} FROM tasks t LEFT JOIN employees a ON a.id = t.assignee_id LEFT JOIN task_projects p ON p.id = t.project_id WHERE t.id = $1 AND t.company_id = $2`, [id, companyId]);
        if (!result.rows[0]) return null;
        const tasks = await this.withSubtasks(result.rows, companyId);
        return tasks[0];
    }

    async createTask(companyId: string, userId: string | undefined, data: unknown) {
        const parsed = TaskSchema.safeParse(data);
        if (!parsed.success) throw new BadRequestException(parsed.error.issues);
        const value = parsed.data;
        await this.assertProject(value.projectId, companyId, userId);
        if (value.parentTaskId) await this.assertTask(value.parentTaskId, companyId);
        const assigneeId = value.assigneeId ?? userId ?? null;
        if (assigneeId) {
            await this.assertEmployee(assigneeId, companyId);
            await this.ensureProjectMember(value.projectId, assigneeId);
        }
        const result = await this.postgres.query<{ id: string }>(`INSERT INTO tasks (id, company_id, project_id, parent_task_id, title, description, status, priority, assignee_id, due_date, labels, comments, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]'::jsonb,$12) RETURNING id`, [uuidv4(), companyId, value.projectId, value.parentTaskId ?? null, value.title, value.description, value.status, value.priority, assigneeId, value.dueDate ?? null, JSON.stringify(value.labels), userId ?? null]);
        return this.getTask(result.rows[0].id, companyId);
    }

    async updateTask(id: string, companyId: string, employeeId: string | undefined, data: unknown) {
        const parsed = UpdateTaskSchema.safeParse(data);
        if (!parsed.success) throw new BadRequestException(parsed.error.issues);
        const value = parsed.data;
        if (value.projectId) await this.assertProject(value.projectId, companyId, employeeId);
        if (value.parentTaskId) { if (value.parentTaskId === id) throw new BadRequestException('A task cannot be its own parent'); await this.assertTask(value.parentTaskId, companyId); }
        if (value.assigneeId) {
            await this.assertEmployee(value.assigneeId, companyId);
            if (value.projectId) await this.ensureProjectMember(value.projectId, value.assigneeId);
            else {
                const current = await this.postgres.query<{ projectId: string }>('SELECT project_id AS "projectId" FROM tasks WHERE id = $1 AND company_id = $2', [id, companyId]);
                if (current.rows[0]) await this.ensureProjectMember(current.rows[0].projectId, value.assigneeId);
            }
        }
        const columnMap: Record<string, string> = { projectId: 'project_id', parentTaskId: 'parent_task_id', title: 'title', description: 'description', status: 'status', priority: 'priority', assigneeId: 'assignee_id', dueDate: 'due_date', labels: 'labels' };
        const updates: string[] = [];
        const params: unknown[] = [];
        for (const [key, column] of Object.entries(columnMap)) if (key in value) { updates.push(`${column} = $${params.length + 1}`); params.push(key === 'labels' ? JSON.stringify((value as Record<string, unknown>)[key]) : (value as Record<string, unknown>)[key]); }
        if (!updates.length) return this.getTask(id, companyId);
        params.push(id, companyId);
        const result = await this.postgres.query<{ id: string }>(`UPDATE tasks SET ${updates.join(', ')}, updated_at = now() WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING id`, params);
        return result.rows[0] ? this.getTask(result.rows[0].id, companyId) : null;
    }

    async addComment(id: string, companyId: string, authorId: string | undefined, data: unknown) {
        const parsed = CommentSchema.safeParse(data);
        if (!parsed.success) throw new BadRequestException(parsed.error.issues);
        const task = await this.getTask(id, companyId);
        if (!task) return null;
        const author = authorId ? await this.postgres.query<{ name: string }>('SELECT name FROM employees WHERE id = $1 AND company_id = $2', [authorId, companyId]) : { rows: [] as { name: string }[] };
        const comment = { id: uuidv4(), authorId: authorId ?? null, authorName: author.rows[0]?.name ?? null, body: parsed.data.body, createdAt: new Date().toISOString() };
        const result = await this.postgres.query<{ id: string }>(`UPDATE tasks SET comments = comments || $1::jsonb, updated_at = now() WHERE id = $2 AND company_id = $3 RETURNING id`, [JSON.stringify([comment]), id, companyId]);
        return result.rows[0] ? this.getTask(result.rows[0].id, companyId) : null;
    }

    private async withSubtasks(rows: any[], companyId: string) {
        if (!rows.length) return rows;
        const ids = rows.map(row => row.id);
        const result = await this.postgres.query<any>(`SELECT ${taskFields} FROM tasks t LEFT JOIN employees a ON a.id = t.assignee_id LEFT JOIN task_projects p ON p.id = t.project_id WHERE t.company_id = $1 AND t.parent_task_id = ANY($2::uuid[]) ORDER BY t.created_at`, [companyId, ids]);
        const byParent = new Map<string, any[]>();
        for (const child of result.rows) { const list = byParent.get(child.parentTaskId) ?? []; list.push(child); byParent.set(child.parentTaskId, list); }
        const hydratedRows = rows.map(row => ({ ...row, subtasks: (byParent.get(row.id) ?? []).map(child => ({ id: child.id, title: child.title, done: child.status === 'done' })) }));
        const authorIds = [...new Set(hydratedRows.flatMap(row => (Array.isArray(row.comments) ? row.comments : []).map((comment: { authorId?: string }) => comment.authorId).filter(Boolean)))];
        if (!authorIds.length) return hydratedRows;
        const authors = await this.postgres.query<{ id: string; name: string }>('SELECT id, name FROM employees WHERE company_id = $1 AND id = ANY($2::uuid[])', [companyId, authorIds]);
        const names = new Map(authors.rows.map(author => [author.id, author.name]));
        return hydratedRows.map(row => ({ ...row, comments: (Array.isArray(row.comments) ? row.comments : []).map((comment: { authorId?: string; authorName?: string }) => ({ ...comment, authorName: comment.authorName || (comment.authorId ? names.get(comment.authorId) : undefined) || 'Team member' })) }));
    }

    private async ensureProjectMember(projectId: string, employeeId: string) {
        await this.postgres.query('INSERT INTO task_project_members (project_id, employee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [projectId, employeeId]);
    }

    private async assertProject(id: string, companyId: string, employeeId?: string) {
        const params: unknown[] = [id, companyId];
        let membership = '';
        if (employeeId) { params.push(employeeId); membership = ` AND EXISTS (SELECT 1 FROM task_project_members pm WHERE pm.project_id = p.id AND pm.employee_id = $${params.length})`; }
        const result = await this.postgres.query(`SELECT p.id FROM task_projects p WHERE p.id = $1 AND p.company_id = $2 AND p.archived_at IS NULL${membership}`, params);
        if (!result.rowCount) throw new BadRequestException('Project not found or you are not a member');
    }
    private async assertTask(id: string, companyId: string) { const result = await this.postgres.query('SELECT id FROM tasks WHERE id = $1 AND company_id = $2', [id, companyId]); if (!result.rowCount) throw new BadRequestException('Parent task not found'); }
    private async assertEmployee(id: string, companyId: string) { const result = await this.postgres.query('SELECT id FROM employees WHERE id = $1 AND company_id = $2', [id, companyId]); if (!result.rowCount) throw new BadRequestException('Assignee not found'); }
}

@Controller('task-projects')
@UseGuards(AuthGuard, CompanyGuard)
export class TaskProjectsController {
    constructor(private readonly service: TasksService) {}
    @Get() list(@Req() req: UserRequest) { return this.service.listProjects(req.user.companyId, req.user.employeeId); }
    @Post() create(@Req() req: UserRequest, @Body() body: unknown) { return this.service.createProject(req.user.companyId, req.user.employeeId, body); }
    @Get(':id') get(@Req() req: UserRequest, @Param('id') id: string) { return this.service.getProject(id, req.user.companyId, req.user.employeeId); }
    @Patch(':id') update(@Req() req: UserRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.updateProject(id, req.user.companyId, req.user.employeeId, body); }
    @Delete(':id') remove(@Req() req: UserRequest, @Param('id') id: string) { return this.service.archiveProject(id, req.user.companyId, req.user.employeeId); }
    @Get(':id/members') members(@Req() req: UserRequest, @Param('id') id: string) { return this.service.listProjectMembers(id, req.user.companyId, req.user.employeeId); }
    @Post(':id/members/:employeeId') addMember(@Req() req: UserRequest, @Param('id') id: string, @Param('employeeId') employeeId: string) { return this.service.addProjectMember(id, req.user.companyId, req.user.employeeId, employeeId); }
    @Delete(':id/members/:employeeId') removeMember(@Req() req: UserRequest, @Param('id') id: string, @Param('employeeId') employeeId: string) { return this.service.removeProjectMember(id, req.user.companyId, req.user.employeeId, employeeId); }
}

@Controller('tasks')
@UseGuards(AuthGuard, CompanyGuard)
export class TasksController {
    constructor(private readonly service: TasksService) {}
    @Get() list(@Req() req: UserRequest, @Query() query: { scope?: string; projectId?: string; status?: string; search?: string }) { return this.service.listTasks(req.user.companyId, req.user.employeeId, query); }
    @Post() create(@Req() req: UserRequest, @Body() body: unknown) { return this.service.createTask(req.user.companyId, req.user.employeeId, body); }
    @Get(':id') get(@Req() req: UserRequest, @Param('id') id: string) { return this.service.getTask(id, req.user.companyId); }
    @Patch(':id') update(@Req() req: UserRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.updateTask(id, req.user.companyId, req.user.employeeId, body); }
    @Post(':id/comments') comment(@Req() req: UserRequest, @Param('id') id: string, @Body() body: unknown) { return this.service.addComment(id, req.user.companyId, req.user.employeeId, body); }
}

@Module({ controllers: [TaskProjectsController, TasksController], providers: [TasksService], exports: [TasksService] })
export class TasksModule {}
