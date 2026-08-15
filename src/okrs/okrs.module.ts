import { BadRequestException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Put, Body, Req, UseGuards, Module } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { PostgresService } from '../postgres/postgres.service';

type OkrStatus = 'draft' | 'active' | 'archived';
type ObjectiveLevel = 'team' | 'individual';
type ObjectiveStatus = 'upcoming' | 'in_progress' | 'completed';
type RequestUser = { id: string; companyId: string };
type DbRow = Record<string, any>;

type OkrCycleInput = {
    headline?: string;
    description?: string | null;
    targetValue?: number;
    unit?: string;
    targetDate?: string;
    status?: OkrStatus;
};

type OkrKeyResultInput = {
    id?: string;
    title?: string;
    description?: string | null;
    unit?: string;
    startValue?: number;
    currentValue?: number;
    targetValue?: number;
    dueDate?: string;
    status?: ObjectiveStatus;
};

type OkrObjectiveInput = {
    cycleId?: string;
    level?: ObjectiveLevel;
    parentObjectiveId?: string | null;
    departmentId?: string | null;
    employeeId?: string | null;
    headline?: string;
    description?: string | null;
    currentValue?: number;
    targetValue?: number;
    unit?: string;
    dueDate?: string;
    status?: ObjectiveStatus;
    keyResults?: OkrKeyResultInput[];
    note?: string;
};

const CYCLE_STATUSES: OkrStatus[] = ['draft', 'active', 'archived'];
const OBJECTIVE_LEVELS: ObjectiveLevel[] = ['team', 'individual'];
const OBJECTIVE_STATUSES: ObjectiveStatus[] = ['upcoming', 'in_progress', 'completed'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class OkrsService {
    constructor(private postgres: PostgresService) {}

    private cycleFields = [
        'id', 'company_id AS "companyId"', 'headline', 'description',
        'target_value AS "targetValue"', 'unit', 'target_date AS "targetDate"', 'status',
        'created_by_user_id AS "createdByUserId"', 'updated_by_user_id AS "updatedByUserId"',
        'created_at AS "createdAt"', 'updated_at AS "updatedAt"',
    ].join(', ');

    private objectiveFields = [
        'o.id', 'o.company_id AS "companyId"', 'o.cycle_id AS "cycleId"', 'o.level',
        'o.parent_objective_id AS "parentObjectiveId"', 'o.department_id AS "departmentId"',
        'o.employee_id AS "employeeId"', 'o.headline', 'o.description',
        'o.current_value AS "currentValue"', 'o.target_value AS "targetValue"', 'o.unit',
        'o.due_date AS "dueDate"', 'o.status', 'o.key_results AS "keyResults"', 'o.progress_history AS "progressHistory"',
        'o.created_by_user_id AS "createdByUserId"', 'o.updated_by_user_id AS "updatedByUserId"',
        'o.created_at AS "createdAt"', 'o.updated_at AS "updatedAt"',
        'd.name AS "departmentName"', 'e.name AS "employeeName"', 'e.photo_url AS "employeePhotoUrl"',
        'r.title AS "employeeRole"', 'editor.name AS "updatedByName"',
    ].join(', ');

    private assertDate(value: string | undefined, field: string) {
        if (!value || !ISO_DATE.test(value)) throw new BadRequestException(`${field} must be an ISO date (YYYY-MM-DD)`);
    }

    private assertNumber(value: unknown, field: string, allowZero = true) {
        if (typeof value !== 'number' || !Number.isFinite(value) || (!allowZero && value <= 0)) {
            throw new BadRequestException(`${field} must be ${allowZero ? 'a finite number' : 'greater than zero'}`);
        }
    }

    private normalizeKeyResults(value: unknown): Required<OkrKeyResultInput>[] {
        if (!Array.isArray(value) || !value.length) throw new BadRequestException('An individual objective requires at least one key result');
        return value.map((keyResult, index) => {
            if (!keyResult || typeof keyResult !== 'object') throw new BadRequestException(`Key result ${index + 1} is invalid`);
            const item = keyResult as OkrKeyResultInput;
            if (!item.title?.trim()) throw new BadRequestException(`Key result ${index + 1} requires a title`);
            this.assertNumber(item.startValue ?? 0, `Key result ${index + 1} startValue`);
            this.assertNumber(item.currentValue, `Key result ${index + 1} currentValue`);
            this.assertNumber(item.targetValue, `Key result ${index + 1} targetValue`, false);
            this.assertDate(item.dueDate, `Key result ${index + 1} dueDate`);
            if (!item.unit?.trim()) throw new BadRequestException(`Key result ${index + 1} requires a unit`);
            if (item.status && !OBJECTIVE_STATUSES.includes(item.status)) throw new BadRequestException(`Key result ${index + 1} has an invalid status`);
            return { id: item.id || uuidv4(), title: item.title.trim(), description: item.description ?? null, unit: item.unit.trim(), startValue: item.startValue ?? 0, currentValue: item.currentValue!, targetValue: item.targetValue!, dueDate: item.dueDate!, status: item.status ?? 'upcoming' };
        });
    }

    private async findCycle(id: string, companyId: string) {
        const result = await this.postgres.query<DbRow>(`SELECT ${this.cycleFields} FROM okr_cycles WHERE id = $1 AND company_id = $2`, [id, companyId]);
        return result.rows[0] ?? null;
    }

    private async findObjective(id: string, companyId: string) {
        const result = await this.postgres.query<DbRow>(`SELECT ${this.objectiveFields}
             FROM okr_objectives o
             LEFT JOIN departments d ON d.id = o.department_id AND d.company_id = o.company_id
             LEFT JOIN employees e ON e.id = o.employee_id AND e.company_id = o.company_id
             LEFT JOIN roles r ON r.id = e.role_id AND r.company_id = e.company_id
             LEFT JOIN users editor ON editor.id = o.updated_by_user_id AND editor.company_id = o.company_id
             WHERE o.id = $1 AND o.company_id = $2`, [id, companyId]);
        return result.rows[0] ?? null;
    }

    async findActive(companyId: string) {
        const result = await this.postgres.query<DbRow>(`SELECT ${this.cycleFields} FROM okr_cycles WHERE company_id = $1 AND status = 'active' LIMIT 1`, [companyId]);
        return result.rows[0] ?? null;
    }

    async createCycle(input: OkrCycleInput, user: RequestUser) {
        this.assertDate(input.targetDate, 'targetDate');
        if (input.targetValue !== undefined) this.assertNumber(input.targetValue, 'targetValue');
        const status = input.status ?? 'draft';
        if (!CYCLE_STATUSES.includes(status)) throw new BadRequestException('Invalid cycle status');
        const id = uuidv4();
        const result = await this.postgres.query<DbRow>(`INSERT INTO okr_cycles
            (id, company_id, headline, description, target_value, unit, target_date, status, created_by_user_id, updated_by_user_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING ${this.cycleFields}`,
            [id, user.companyId, input.headline ?? '', input.description ?? null, input.targetValue ?? 0, input.unit ?? '', input.targetDate, status, user.id]);
        return result.rows[0];
    }

    async updateCycle(id: string, input: OkrCycleInput, user: RequestUser) {
        const existing = await this.findCycle(id, user.companyId);
        if (!existing) throw new NotFoundException('OKR cycle not found');
        if (input.targetDate !== undefined) this.assertDate(input.targetDate, 'targetDate');
        if (input.targetValue !== undefined) this.assertNumber(input.targetValue, 'targetValue');
        if (input.status && !CYCLE_STATUSES.includes(input.status)) throw new BadRequestException('Invalid cycle status');
        const values: unknown[] = [];
        const changes: string[] = [];
        const columns: Record<string, string> = { headline: 'headline', description: 'description', targetValue: 'target_value', unit: 'unit', targetDate: 'target_date', status: 'status' };
        Object.entries(columns).forEach(([key, column]) => {
            if (Object.prototype.hasOwnProperty.call(input, key)) {
                values.push(input[key as keyof OkrCycleInput]);
                changes.push(`${column} = $${values.length}`);
            }
        });
        if (!changes.length) return existing;
        values.push(user.id, id, user.companyId);
        const result = await this.postgres.query<DbRow>(`UPDATE okr_cycles SET ${changes.join(', ')}, updated_by_user_id = $${values.length - 2}, updated_at = now()
            WHERE id = $${values.length - 1} AND company_id = $${values.length} RETURNING ${this.cycleFields}`, values);
        return result.rows[0];
    }

    private async assertObjectiveRelations(input: OkrObjectiveInput, companyId: string) {
        if (input.level === 'team') {
            if (!input.departmentId) throw new BadRequestException('A team objective requires a departmentId');
            if (input.employeeId || input.parentObjectiveId) throw new BadRequestException('A team objective cannot have an employee or parent objective');
            const department = await this.postgres.query<DbRow>('SELECT id FROM departments WHERE id = $1 AND company_id = $2', [input.departmentId, companyId]);
            if (!department.rows[0]) throw new BadRequestException('Department does not belong to this company');
        }
        if (input.level === 'individual') {
            if (input.departmentId !== undefined && input.departmentId !== null) throw new BadRequestException('Individual objectives inherit their department from the employee and team');
            if (!input.employeeId || !input.parentObjectiveId) throw new BadRequestException('An individual objective requires employeeId and parentObjectiveId');
            const employee = await this.postgres.query<DbRow>('SELECT department_id FROM employees WHERE id = $1 AND company_id = $2', [input.employeeId, companyId]);
            if (!employee.rows[0]) throw new BadRequestException('Employee does not belong to this company');
            const parent = await this.postgres.query<DbRow>('SELECT id, cycle_id, level, department_id FROM okr_objectives WHERE id = $1 AND company_id = $2', [input.parentObjectiveId, companyId]);
            if (!parent.rows[0] || parent.rows[0].level !== 'team' || parent.rows[0].cycle_id !== input.cycleId) throw new BadRequestException('Parent must be a team objective in the same cycle');
            if (employee.rows[0].department_id !== parent.rows[0].department_id) throw new BadRequestException('Employee must belong to the parent team department');
        }
    }

    async createObjective(input: OkrObjectiveInput, user: RequestUser) {
        if (!input.cycleId || !input.level) throw new BadRequestException('cycleId and level are required');
        if (!OBJECTIVE_LEVELS.includes(input.level)) throw new BadRequestException('Invalid objective level');
        const isIndividual = input.level === 'individual';
        const keyResults = isIndividual ? this.normalizeKeyResults(input.keyResults) : [];
        if (!isIndividual && (input.currentValue !== undefined || input.targetValue !== undefined || input.unit !== undefined || input.dueDate !== undefined || input.status !== undefined || input.keyResults !== undefined || input.note !== undefined)) {
            throw new BadRequestException('Team objective progress is calculated from its individual objectives');
        }
        if (!await this.findCycle(input.cycleId, user.companyId)) throw new BadRequestException('Cycle does not belong to this company');
        await this.assertObjectiveRelations(input, user.companyId);
        const id = uuidv4();
        const history = [];
        await this.postgres.query(`INSERT INTO okr_objectives
            (id, company_id, cycle_id, level, parent_objective_id, department_id, employee_id, headline, description, current_value, target_value, unit, due_date, status, key_results, progress_history, created_by_user_id, updated_by_user_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,NULL,NULL,NULL,$10::jsonb,$11::jsonb,$12,$12)`,
            [id, user.companyId, input.cycleId, input.level, input.parentObjectiveId ?? null, input.departmentId ?? null, input.employeeId ?? null, input.headline ?? '', input.description ?? null, JSON.stringify(keyResults), JSON.stringify(history), user.id]);
        return this.findObjective(id, user.companyId);
    }

    async updateObjective(id: string, input: OkrObjectiveInput, user: RequestUser) {
        const existing = await this.findObjective(id, user.companyId);
        if (!existing) throw new NotFoundException('OKR objective not found');
        const definedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as OkrObjectiveInput;
        if (input.level && input.level !== existing.level) throw new BadRequestException('Objective level cannot be changed');
        const merged = { ...existing, ...definedInput, cycleId: input.cycleId ?? existing.cycleId, level: existing.level } as OkrObjectiveInput;
        const isIndividual = existing.level === 'individual';
        if (isIndividual && input.departmentId !== undefined && input.departmentId !== null) throw new BadRequestException('Individual objectives inherit their department from the employee and team');
        const keyResults = input.keyResults === undefined ? undefined : this.normalizeKeyResults(input.keyResults);
        if (!isIndividual && (input.currentValue !== undefined || input.targetValue !== undefined || input.unit !== undefined || input.dueDate !== undefined || input.status !== undefined || input.keyResults !== undefined || input.note !== undefined)) {
            throw new BadRequestException('Team objective progress is calculated from its individual objectives');
        }
        await this.assertObjectiveRelations(merged, user.companyId);
        const values: unknown[] = [];
        const changes: string[] = [];
        const columns: Record<string, string> = { cycleId: 'cycle_id', parentObjectiveId: 'parent_objective_id', departmentId: 'department_id', employeeId: 'employee_id', headline: 'headline', description: 'description' };
        Object.entries(columns).forEach(([key, column]) => {
            if (Object.prototype.hasOwnProperty.call(input, key)) { values.push(input[key as keyof OkrObjectiveInput]); changes.push(`${column} = $${values.length}`); }
        });
        if (keyResults !== undefined) { values.push(JSON.stringify(keyResults)); changes.push(`key_results = $${values.length}::jsonb`); }
        if (!changes.length) return existing;
        values.push(user.id, id, user.companyId);
        await this.postgres.query(`UPDATE okr_objectives SET ${changes.join(', ')}, updated_by_user_id = $${values.length - 2}, updated_at = now()
            WHERE id = $${values.length - 1} AND company_id = $${values.length}`, values);
        return this.findObjective(id, user.companyId);
    }

    async deleteObjective(id: string, companyId: string) {
        await this.postgres.query('DELETE FROM okr_objectives WHERE id = $1 AND company_id = $2', [id, companyId]);
    }

    private progress(objective: any) {
        const keyResults = Array.isArray(objective.keyResults) ? objective.keyResults : [];
        if (keyResults.length) return Math.round(keyResults.reduce((total: number, keyResult: any) => total + (Number(keyResult.targetValue) > 0 ? Math.min(100, Math.max(0, (Number(keyResult.currentValue) / Number(keyResult.targetValue)) * 100)) : 0), 0) / keyResults.length);
        return objective.targetValue > 0 ? Math.min(100, Math.max(0, Math.round((Number(objective.currentValue) / Number(objective.targetValue)) * 100))) : 0;
    }

    private statusForProgress(progress: number): ObjectiveStatus {
        return progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'upcoming';
    }

    async board(cycleId: string, companyId: string) {
        const cycle = await this.findCycle(cycleId, companyId);
        if (!cycle) throw new NotFoundException('OKR cycle not found');
        const result = await this.postgres.query<DbRow>(`SELECT ${this.objectiveFields}
            FROM okr_objectives o
            LEFT JOIN departments d ON d.id = o.department_id AND d.company_id = o.company_id
            LEFT JOIN employees e ON e.id = o.employee_id AND e.company_id = o.company_id
            LEFT JOIN roles r ON r.id = e.role_id AND r.company_id = e.company_id
            LEFT JOIN users editor ON editor.id = o.updated_by_user_id AND editor.company_id = o.company_id
            WHERE o.company_id = $1 AND o.cycle_id = $2 ORDER BY o.level, o.created_at`, [companyId, cycleId]);
        const objectives = result.rows.map((row: any) => ({ ...row, currentValue: row.currentValue === null ? null : Number(row.currentValue), targetValue: row.targetValue === null ? null : Number(row.targetValue), keyResults: Array.isArray(row.keyResults) ? row.keyResults : [], progress: row.level === 'individual' ? this.progress(row) : 0, progressHistory: Array.isArray(row.progressHistory) ? row.progressHistory : [] }));
        const individualByParent = new Map<string, any[]>();
        objectives.filter((item: any) => item.level === 'individual').forEach((item: any) => {
            const list = individualByParent.get(item.parentObjectiveId) ?? []; list.push(item); individualByParent.set(item.parentObjectiveId, list);
        });
        const departments = objectives.filter((item: any) => item.level === 'team').map((team: any) => {
            const individuals = individualByParent.get(team.id) ?? [];
            const progress = individuals.length ? Math.round(individuals.reduce((total, item) => total + item.progress, 0) / individuals.length) : 0;
            return { id: team.departmentId, name: team.departmentName, teamObjective: { ...team, progress, status: this.statusForProgress(progress) }, individuals };
        });
        const companyProgress = departments.length ? Math.round(departments.reduce((total: number, item: any) => total + item.teamObjective.progress, 0) / departments.length) : 0;
        return { cycle: { ...cycle, targetValue: Number(cycle.targetValue), progress: companyProgress }, departments };
    }
}

@Controller('okrs')
@UseGuards(AuthGuard, CompanyGuard)
export class OkrsController {
    constructor(private service: OkrsService) {}

    @Get('active') active(@Req() req: { user: RequestUser }) { return this.service.findActive(req.user.companyId); }
    @Get('active/board') async activeBoard(@Req() req: { user: RequestUser }) {
        const cycle = await this.service.findActive(req.user.companyId);
        return cycle ? this.service.board(cycle.id, req.user.companyId) : null;
    }
    @Get('cycles/:id/board') board(@Param('id') id: string, @Req() req: { user: RequestUser }) { return this.service.board(id, req.user.companyId); }
    @Post('cycles') createCycle(@Body() input: OkrCycleInput, @Req() req: { user: RequestUser }) { return this.service.createCycle(input, req.user); }
    @Put('cycles/:id') updateCycle(@Param('id') id: string, @Body() input: OkrCycleInput, @Req() req: { user: RequestUser }) { return this.service.updateCycle(id, input, req.user); }
    @Post('objectives') createObjective(@Body() input: OkrObjectiveInput, @Req() req: { user: RequestUser }) { return this.service.createObjective(input, req.user); }
    @Put('objectives/:id') updateObjective(@Param('id') id: string, @Body() input: OkrObjectiveInput, @Req() req: { user: RequestUser }) { return this.service.updateObjective(id, input, req.user); }
    @Delete('objectives/:id') deleteObjective(@Param('id') id: string, @Req() req: { user: RequestUser }) { return this.service.deleteObjective(id, req.user.companyId); }
}

@Module({ controllers: [OkrsController], providers: [OkrsService], exports: [OkrsService] })
export class OkrsModule {}
