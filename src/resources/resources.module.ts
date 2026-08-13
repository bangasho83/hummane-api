import {
    Module,
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Body,
    Req,
    Query,
    UseGuards,
    Injectable,
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { PostgresService } from '../postgres/postgres.service';
import { parseLimit } from '../utils/pagination';
import {
    Resource,
    ResourceSchema,
    ResourceAssignmentPatchSchema,
} from '../schemas/hr.schema';
import { RESOURCE_CATEGORIES } from './resource-categories.constants';

@Injectable()
export class ResourcesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'resource_template_id AS "resourceTemplateId"',
        'vendor_id AS "vendorId"',
        'resource_type AS "resourceType"',
        'name',
        'category',
        'description',
        'identifier',
        'status',
        'assignment_type AS "assignmentType"',
        'assigned_to_employee_id AS "assignedToEmployeeId"',
        'location',
        'assigned_at AS "assignedAt"',
        'assignment_history AS "assignmentHistory"',
        'cost_amount AS "costAmount"',
        'cost_type AS "costType"',
        'expense_date AS "expenseDate"',
        'paid_by_employee_id AS "paidByEmployeeId"',
        'is_settled AS "isSettled"',
        'attachments',
        'details',
        'created_by AS "createdBy"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Resource) {
        let template: any = null;
        if (data.resourceTemplateId) {
            const templateResult = await this.postgres.query(
                `SELECT * FROM resource_templates WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1`,
                [data.resourceTemplateId, data.companyId],
            );
            if (templateResult.rowCount === 0) {
                throw new NotFoundException('Resource template not found or inactive');
            }
            template = templateResult.rows[0];
        }

        const name = data.name || template?.name;
        const category = data.category || template?.category;
        const resourceType = data.resourceType || template?.resource_type;
        const vendorId = data.vendorId || template?.vendor_id;
        const costAmount = data.costAmount ?? template?.default_cost_amount;
        const costType = data.costType || template?.default_cost_type;
        const details = {
            ...(template?.default_details && typeof template.default_details === 'object' ? template.default_details : {}),
            ...(data.details || {}),
        };

        if (!name || !category) {
            throw new BadRequestException('Name and category are required');
        }
        if (!RESOURCE_CATEGORIES.find((c) => c.name === category)) {
            throw new BadRequestException('Invalid category');
        }

        const id = data.id || uuidv4();
        const result = await this.postgres.query<Resource>(
            `INSERT INTO resources (
                id, company_id, resource_template_id, vendor_id, resource_type, name, category, description,
                identifier, status, assignment_type, assigned_to_employee_id, location,
                assigned_at, assignment_history, cost_amount, cost_type, expense_date,
                paid_by_employee_id, is_settled, attachments, details, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23
            )
            RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.resourceTemplateId || null,
                vendorId || null,
                resourceType,
                name,
                category,
                data.description ?? null,
                data.identifier ?? null,
                data.status ?? 'active',
                data.assignmentType ?? 'not_applicable',
                data.assignedToEmployeeId || null,
                data.location ?? null,
                data.assignedAt ?? (data.assignedToEmployeeId ? new Date().toISOString() : null),
                JSON.stringify(data.assignmentHistory ?? []),
                costAmount ?? null,
                costType ?? null,
                data.expenseDate || null,
                data.paidByEmployeeId || null,
                data.isSettled ?? true,
                data.attachments ? JSON.stringify(data.attachments) : JSON.stringify({ files: [] }),
                JSON.stringify(details),
                data.createdBy || null,
            ],
        );
        return result.rows[0];
    }

    async findAll(
        companyId: string,
        limit: number,
        filters: {
            resourceType?: string;
            status?: string;
            assignedToEmployeeId?: string;
            vendorId?: string;
            resourceTemplateId?: string;
        } = {},
    ) {
        const conditions = ['company_id = $1'];
        const values: unknown[] = [companyId];
        let index = 2;

        if (filters.resourceType) {
            conditions.push(`resource_type = $${index++}`);
            values.push(filters.resourceType);
        }
        if (filters.status) {
            conditions.push(`status = $${index++}`);
            values.push(filters.status);
        }
        if (filters.assignedToEmployeeId) {
            conditions.push(`assigned_to_employee_id = $${index++}`);
            values.push(filters.assignedToEmployeeId);
        }
        if (filters.vendorId) {
            conditions.push(`vendor_id = $${index++}`);
            values.push(filters.vendorId);
        }
        if (filters.resourceTemplateId) {
            conditions.push(`resource_template_id = $${index++}`);
            values.push(filters.resourceTemplateId);
        }

        values.push(limit);
        const result = await this.postgres.query<Resource>(
            `SELECT ${this.selectFields}
             FROM resources
             WHERE ${conditions.join(' AND ')}
             ORDER BY created_at DESC
             LIMIT $${index}`,
            values,
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string, assignedToEmployeeId?: string) {
        const assignmentClause = assignedToEmployeeId !== undefined
            ? ' AND assigned_to_employee_id = $3'
            : '';
        const result = await this.postgres.query<Resource>(
            `SELECT ${this.selectFields}
             FROM resources
             WHERE id = $1 AND company_id = $2${assignmentClause}
             LIMIT 1`,
            assignedToEmployeeId !== undefined ? [id, companyId, assignedToEmployeeId] : [id, companyId],
        );
        if (result.rowCount === 0) {
            throw new NotFoundException('Resource not found');
        }
        return result.rows[0];
    }

    async update(id: string, data: Partial<Resource>, companyId: string) {
        if (data.category && !RESOURCE_CATEGORIES.find((c) => c.name === data.category)) {
            throw new BadRequestException('Invalid category');
        }

        const columnMap: Record<string, string> = {
            vendorId: 'vendor_id',
            resourceTemplateId: 'resource_template_id',
            resourceType: 'resource_type',
            name: 'name',
            category: 'category',
            description: 'description',
            identifier: 'identifier',
            status: 'status',
            location: 'location',
            costAmount: 'cost_amount',
            costType: 'cost_type',
            expenseDate: 'expense_date',
            paidByEmployeeId: 'paid_by_employee_id',
            isSettled: 'is_settled',
        };
        const jsonFields = new Set(['attachments', 'details']);
        const nullableEmptyStringFields = new Set([
            'vendorId',
            'expenseDate',
            'paidByEmployeeId',
        ]);

        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        for (const [key, column] of Object.entries(columnMap)) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = (data as any)[key];
                updates.push(`${column} = $${index++}`);
                values.push(nullableEmptyStringFields.has(key) ? value || null : value ?? null);
            }
        }
        for (const key of jsonFields) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                updates.push(`${key} = $${index++}`);
                values.push(JSON.stringify((data as any)[key]));
            }
        }

        if (updates.length === 0) {
            return this.findOne(id, companyId);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Resource>(
            `UPDATE resources
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        if (result.rowCount === 0) {
            throw new NotFoundException('Resource not found');
        }
        return result.rows[0];
    }

    async costReport(
        companyId: string,
        filters: {
            resourceType?: string;
            status?: string;
            employeeId?: string;
            resourceTemplateId?: string;
        } = {},
    ) {
        const conditions = ['r.company_id = $1', 'r.cost_amount IS NOT NULL'];
        const values: unknown[] = [companyId];
        let index = 2;
        if (filters.resourceType) {
            conditions.push(`r.resource_type = $${index++}`);
            values.push(filters.resourceType);
        }
        if (filters.status) {
            conditions.push(`r.status = $${index++}`);
            values.push(filters.status);
        }
        if (filters.employeeId) {
            conditions.push(`r.assigned_to_employee_id = $${index++}`);
            values.push(filters.employeeId);
        }
        if (filters.resourceTemplateId) {
            conditions.push(`r.resource_template_id = $${index++}`);
            values.push(filters.resourceTemplateId);
        }
        const where = conditions.join(' AND ');
        const [total, byTemplate, byEmployee] = await Promise.all([
            this.postgres.query<{ totalCost: number; resourceCount: number }>(
                `SELECT COALESCE(SUM(r.cost_amount), 0) AS "totalCost", COUNT(*)::int AS "resourceCount"
                 FROM resources r WHERE ${where}`,
                values,
            ),
            this.postgres.query(
                `SELECT r.resource_template_id AS "templateId",
                        COALESCE(rt.name, r.name) AS "templateName",
                        COALESCE(SUM(r.cost_amount), 0) AS "totalCost",
                        COUNT(*)::int AS "resourceCount"
                 FROM resources r
                 LEFT JOIN resource_templates rt ON rt.id = r.resource_template_id AND rt.company_id = r.company_id
                 WHERE ${where}
                 GROUP BY r.resource_template_id, COALESCE(rt.name, r.name)
                 ORDER BY "totalCost" DESC, "templateName" ASC`,
                values,
            ),
            this.postgres.query(
                `SELECT r.assigned_to_employee_id AS "employeeId",
                        COALESCE(e.name, CASE WHEN r.assignment_type IN ('shared', 'company') THEN 'Shared / Company' ELSE 'Unassigned' END) AS "employeeName",
                        r.resource_template_id AS "templateId",
                        COALESCE(rt.name, r.name) AS "templateName",
                        COALESCE(SUM(r.cost_amount), 0) AS "totalCost",
                        COUNT(*)::int AS "resourceCount"
                 FROM resources r
                 LEFT JOIN employees e ON e.id = r.assigned_to_employee_id AND e.company_id = r.company_id
                 LEFT JOIN resource_templates rt ON rt.id = r.resource_template_id AND rt.company_id = r.company_id
                 WHERE ${where}
                 GROUP BY r.assigned_to_employee_id, e.name, r.assignment_type, r.resource_template_id, COALESCE(rt.name, r.name)
                 ORDER BY "employeeName" ASC, "totalCost" DESC`,
                values,
            ),
        ]);
        return {
            totalCost: total.rows[0]?.totalCost ?? 0,
            resourceCount: total.rows[0]?.resourceCount ?? 0,
            byTemplate: byTemplate.rows,
            byEmployee: byEmployee.rows,
        };
    }

    async reassign(
        id: string,
        companyId: string,
        changedBy: string,
        assignment: {
            assignmentType: string;
            assignedToEmployeeId?: string;
            location?: string;
            note?: string;
        },
    ) {
        return this.postgres.withTransaction(async (client) => {
            const existingRes = await client.query(
                `SELECT * FROM resources WHERE id = $1 AND company_id = $2 FOR UPDATE`,
                [id, companyId],
            );
            if (existingRes.rowCount === 0) {
                throw new NotFoundException('Resource not found');
            }
            const existing = existingRes.rows[0];

            const changedByRes = await client.query(
                `SELECT name FROM employees WHERE id = $1 AND company_id = $2`,
                [changedBy, companyId],
            );
            const changedByName =
                changedByRes.rowCount > 0 ? changedByRes.rows[0].name : null;

            const history = Array.isArray(existing.assignment_history)
                ? existing.assignment_history
                : [];

            const hadAssignment =
                existing.assignment_type !== 'not_applicable' &&
                existing.assignment_type !== 'unassigned' &&
                existing.assigned_to_employee_id;

            if (hadAssignment) {
                let previousName: string | null = null;
                if (existing.assigned_to_employee_id) {
                    const prevRes = await client.query(
                        `SELECT name FROM employees WHERE id = $1 AND company_id = $2`,
                        [existing.assigned_to_employee_id, companyId],
                    );
                    previousName = prevRes.rowCount > 0 ? prevRes.rows[0].name : null;
                }
                history.push({
                    assignmentType: existing.assignment_type,
                    employeeId: existing.assigned_to_employee_id || null,
                    employeeName: previousName,
                    location: existing.location || null,
                    assignedAt: existing.assigned_at
                        ? new Date(existing.assigned_at).toISOString()
                        : null,
                    unassignedAt: new Date().toISOString(),
                    changedBy,
                    changedByName,
                    note: assignment.note || null,
                });
            }

            const isActiveAssignment =
                assignment.assignmentType !== 'not_applicable' &&
                assignment.assignmentType !== 'unassigned';

            const result = await client.query(
                `UPDATE resources SET
                    assignment_type = $1,
                    assigned_to_employee_id = $2,
                    location = $3,
                    assigned_at = $4,
                    assignment_history = $5,
                    updated_at = now()
                WHERE id = $6 AND company_id = $7
                RETURNING ${this.selectFields}`,
                [
                    assignment.assignmentType,
                    assignment.assignedToEmployeeId || null,
                    assignment.location ?? null,
                    isActiveAssignment ? new Date().toISOString() : null,
                    JSON.stringify(history),
                    id,
                    companyId,
                ],
            );
            return result.rows[0];
        });
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM resources WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('resources')
@UseGuards(AuthGuard, CompanyGuard)
export class ResourcesController {
    constructor(private service: ResourcesService) { }

    private assertOwner(req: any) {
        if (req.user.role !== 'owner') throw new ForbiddenException('Only company owners can view resource cost reports');
    }

    @Post()
    create(@Body() data: Resource, @Req() req: any) {
        data.companyId = req.user.companyId;
        if (req.user.role !== 'owner' && data.resourceType === 'reimbursement') {
            if (!req.user.employeeId) throw new ForbiddenException('Employee profile is required for reimbursement submissions');
            data.assignmentType = 'person';
            data.assignedToEmployeeId = req.user.employeeId;
            data.paidByEmployeeId = req.user.employeeId;
            data.isSettled = false;
        }
        if (!data.createdBy) {
            data.createdBy = req.user.employeeId;
        }
        const v = ResourceSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }
        return this.service.create(v.data as Resource);
    }

    @Get()
    findAll(
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('resourceType') resourceType?: string,
        @Query('status') status?: string,
        @Query('assignedToEmployeeId') assignedToEmployeeId?: string,
        @Query('vendorId') vendorId?: string,
        @Query('resourceTemplateId') resourceTemplateId?: string,
    ) {
        const canManageResources = req.user.role === 'owner' || req.user.role === 'admin';
        const employeeScope = canManageResources ? undefined : req.user.employeeId;
        if (!canManageResources && !employeeScope) return [];
        return this.service.findAll(req.user.companyId, parseLimit(limit), {
            resourceType,
            status,
            assignedToEmployeeId: employeeScope || assignedToEmployeeId,
            vendorId,
            resourceTemplateId,
        });
    }

    @Get('reports/costs')
    costReport(
        @Req() req: any,
        @Query('resourceType') resourceType?: string,
        @Query('status') status?: string,
        @Query('employeeId') employeeId?: string,
        @Query('resourceTemplateId') resourceTemplateId?: string,
    ) {
        this.assertOwner(req);
        return this.service.costReport(req.user.companyId, {
            resourceType,
            status,
            employeeId,
            resourceTemplateId,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        const canManageResources = req.user.role === 'owner' || req.user.role === 'admin';
        const employeeScope = canManageResources ? undefined : (req.user.employeeId || '');
        return this.service.findOne(id, req.user.companyId, employeeScope);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Resource>, @Req() req: any) {
        const updateData = { ...data };
        delete (updateData as Partial<Resource>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Patch(':id/assignment')
    reassign(@Param('id') id: string, @Body() data: any, @Req() req: any) {
        const v = ResourceAssignmentPatchSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }
        return this.service.reassign(
            id,
            req.user.companyId,
            req.user.employeeId,
            v.data,
        );
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: any) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [ResourcesController],
    providers: [ResourcesService],
    exports: [ResourcesService],
})
export class ResourcesModule { }
