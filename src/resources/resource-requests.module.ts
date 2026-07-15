import {
    Module,
    Injectable,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Param,
    Body,
    Req,
    UseGuards,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { EmailService } from '../email/email.service';
import {
    ResourceRequestSchema,
    ResourceRequestStatusPatchSchema,
    ResourceRequest,
} from '../schemas/hr.schema';
import { RESOURCE_CATEGORIES } from './resource-categories.constants';

@Injectable()
export class ResourceRequestsService {
    constructor(
        private pg: PostgresService,
        private emailService: EmailService,
    ) { }

    async create(companyId: string, employeeId: string, data: ResourceRequest): Promise<ResourceRequest> {
        const created = await this.pg.withTransaction(async (client) => {
            // Validate category
            const categoryObj = RESOURCE_CATEGORIES.find((c) => c.name === data.category);
            if (!categoryObj) {
                throw new BadRequestException('Invalid category');
            }

            // Get employee details
            const empResult = await client.query(
                `SELECT name, email FROM employees WHERE id = $1 AND company_id = $2`,
                [employeeId, companyId]
            );
            if (empResult.rowCount === 0) {
                throw new BadRequestException('Employee not found');
            }
            const empName = empResult.rows[0].name;
            const empEmail = empResult.rows[0].email;

            const statusHistory = [
                {
                    status: 'pending',
                    changedBy: employeeId,
                    changedByName: empName,
                    changedAt: new Date().toISOString(),
                    note: null,
                },
            ];

            const result = await client.query(
                `INSERT INTO resource_requests (
                    company_id, employee_id, title, category, description, 
                    goal_alignment, priority, estimated_cost, product_url, 
                    attachments, status, status_history, employee_name, employee_email
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *`,
                [
                    companyId,
                    employeeId,
                    data.title,
                    data.category,
                    data.description || null,
                    data.goalAlignment || null,
                    data.priority || 'normal',
                    data.estimatedCost || null,
                    data.productUrl || null,
                    data.attachments || null,
                    'pending',
                    JSON.stringify(statusHistory),
                    empName,
                    empEmail,
                ]
            );

            const emailHtml = `
                <p><strong>${empName}</strong> has submitted a new resource request.</p>
                <ul>
                    <li><strong>Title:</strong> ${data.title}</li>
                    <li><strong>Category:</strong> ${data.category}</li>
                    <li><strong>Priority:</strong> ${data.priority || 'normal'}</li>
                    ${data.description ? `<li><strong>Description:</strong> ${data.description}</li>` : ''}
                    ${data.goalAlignment ? `<li><strong>Goal Alignment:</strong> ${data.goalAlignment}</li>` : ''}
                    ${data.estimatedCost ? `<li><strong>Estimated Cost:</strong> $${data.estimatedCost}</li>` : ''}
                    ${data.productUrl ? `<li><strong>Product URL:</strong> <a href="${data.productUrl}">${data.productUrl}</a></li>` : ''}
                </ul>
                <p>Please review it in the HR portal.</p>
            `;

            return {
                request: this.mapToCamelCase(result.rows[0]),
                empName,
                emailHtml,
            };
        });

        await this.notifyApprovers(
            companyId,
            employeeId,
            `New resource request from ${created.empName}`,
            created.emailHtml,
        );

        return created.request;
    }

    async findAllForCompany(companyId: string): Promise<ResourceRequest[]> {
        const result = await this.pg.query(
            `SELECT * FROM resource_requests WHERE company_id = $1 ORDER BY created_at DESC`,
            [companyId]
        );
        return result.rows.map(this.mapToCamelCase);
    }

    async findAllForEmployee(companyId: string, employeeId: string): Promise<ResourceRequest[]> {
        const result = await this.pg.query(
            `SELECT * FROM resource_requests WHERE company_id = $1 AND employee_id = $2 ORDER BY created_at DESC`,
            [companyId, employeeId]
        );
        return result.rows.map(this.mapToCamelCase);
    }

    async findOne(companyId: string, id: string): Promise<ResourceRequest> {
        const result = await this.pg.query(
            `SELECT * FROM resource_requests WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );
        if (result.rowCount === 0) {
            throw new NotFoundException('Resource request not found');
        }
        return this.mapToCamelCase(result.rows[0]);
    }

    async update(companyId: string, employeeId: string, id: string, data: Partial<ResourceRequest>): Promise<ResourceRequest> {
        const existing = await this.findOne(companyId, id);

        if (existing.employeeId !== employeeId) {
            throw new ForbiddenException('You can only update your own requests');
        }
        if (existing.status !== 'pending') {
            throw new BadRequestException('Only pending requests can be updated');
        }

        if (data.category && !RESOURCE_CATEGORIES.find((c) => c.name === data.category)) {
            throw new BadRequestException('Invalid category');
        }

        const result = await this.pg.query(
            `UPDATE resource_requests SET
                title = COALESCE($1, title),
                category = COALESCE($2, category),
                description = COALESCE($3, description),
                goal_alignment = COALESCE($4, goal_alignment),
                priority = COALESCE($5, priority),
                estimated_cost = COALESCE($6, estimated_cost),
                product_url = COALESCE($7, product_url),
                attachments = COALESCE($8, attachments),
                updated_at = now()
            WHERE id = $9 AND company_id = $10 AND employee_id = $11
            RETURNING *`,
            [
                data.title,
                data.category,
                data.description,
                data.goalAlignment,
                data.priority,
                data.estimatedCost,
                data.productUrl,
                data.attachments ? JSON.stringify(data.attachments) : null,
                id,
                companyId,
                employeeId
            ]
        );

        return this.mapToCamelCase(result.rows[0]);
    }

    async patchStatus(companyId: string, adminEmployeeId: string, id: string, status: string, reviewerNote?: string): Promise<ResourceRequest> {
        const change = await this.pg.withTransaction(async (client) => {
            const existingRes = await client.query(
                `SELECT * FROM resource_requests WHERE id = $1 AND company_id = $2`,
                [id, companyId]
            );
            if (existingRes.rowCount === 0) {
                throw new NotFoundException('Resource request not found');
            }
            const existing = existingRes.rows[0];

            if (existing.status === status) {
                return {
                    request: this.mapToCamelCase(existing),
                    previousStatus: existing.status,
                    recipients: [],
                    changed: false,
                };
            }

            const adminRes = await client.query(`SELECT name FROM employees WHERE id = $1`, [adminEmployeeId]);
            const adminName = adminRes.rowCount > 0 ? adminRes.rows[0].name : 'System/Admin';

            const newHistoryEntry = {
                status,
                changedBy: adminEmployeeId,
                changedByName: adminName,
                changedAt: new Date().toISOString(),
                note: reviewerNote || null,
            };

            const history = existing.status_history || [];
            history.push(newHistoryEntry);

            const result = await client.query(
                `UPDATE resource_requests SET
                    status = $1,
                    reviewer_note = $2,
                    status_history = $3,
                    updated_at = now()
                WHERE id = $4 AND company_id = $5
                RETURNING *`,
                [status, reviewerNote || null, JSON.stringify(history), id, companyId]
            );

            const contactRes = await client.query(
                `SELECT
                    e.email AS employee_email,
                    e.name AS employee_name,
                    m.email AS manager_email,
                    m.name AS manager_name
                 FROM employees e
                 LEFT JOIN employees m
                   ON m.id = e.reporting_manager_id AND m.company_id = e.company_id
                 WHERE e.id = $1 AND e.company_id = $2`,
                [existing.employee_id, companyId]
            );

            const contact = contactRes.rows[0] || {};
            const recipientsMap = new Map<string, string>();
            const employeeEmail = contact.employee_email || existing.employee_email;
            const employeeName = contact.employee_name || existing.employee_name;

            if (employeeEmail) {
                recipientsMap.set(employeeEmail, employeeName);
            }
            if (contact.manager_email) {
                recipientsMap.set(contact.manager_email, contact.manager_name);
            }

            return {
                request: this.mapToCamelCase(result.rows[0]),
                previousStatus: existing.status,
                recipients: Array.from(recipientsMap.entries()).map(([email, name]) => ({ email, name })),
                changed: true,
            };
        });

        if (change.changed && change.recipients.length > 0) {
            const statusLabel = this.formatLabel(change.request.status || status);
            await this.emailService.sendEmail(
                change.recipients,
                `Resource request ${statusLabel}: ${change.request.title}`,
                this.buildStatusUpdateEmail(change.request, change.previousStatus, reviewerNote)
            );
        }

        return change.request;
    }

    async remove(companyId: string, employeeId: string, id: string, isAdmin: boolean): Promise<void> {
        const existing = await this.findOne(companyId, id);

        if (!isAdmin && existing.employeeId !== employeeId) {
            throw new ForbiddenException('You can only delete your own requests');
        }

        if (!isAdmin) {
            // Employee cancelling their own
            if (existing.status !== 'pending') {
                throw new BadRequestException('You can only cancel pending requests');
            }
            
            const history = existing.statusHistory || [];
            history.push({
                status: 'cancelled',
                changedBy: employeeId,
                changedByName: existing.employeeName,
                changedAt: new Date().toISOString(),
                note: null,
            });

            await this.pg.query(
                `UPDATE resource_requests SET status = 'cancelled', status_history = $1, updated_at = now() WHERE id = $2 AND company_id = $3`,
                [JSON.stringify(history), id, companyId]
            );
        } else {
            // Admin hard delete
            await this.pg.query(
                `DELETE FROM resource_requests WHERE id = $1 AND company_id = $2`,
                [id, companyId]
            );
        }
    }

    // Helper to map DB snake_case to camelCase
    private mapToCamelCase(row: any): ResourceRequest {
        return {
            id: row.id,
            companyId: row.company_id,
            employeeId: row.employee_id,
            title: row.title,
            category: row.category,
            description: row.description,
            goalAlignment: row.goal_alignment,
            priority: row.priority,
            estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
            productUrl: row.product_url,
            status: row.status,
            reviewerNote: row.reviewer_note,
            statusHistory: row.status_history,
            attachments: row.attachments,
            employeeName: row.employee_name,
            employeeEmail: row.employee_email,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private buildStatusUpdateEmail(request: ResourceRequest, previousStatus: string, reviewerNote?: string): string {
        const status = this.formatLabel(request.status || 'updated');
        const previous = this.formatLabel(previousStatus);
        const attachments = request.attachments?.files?.length || 0;
        const productUrl = request.productUrl ? this.escapeHtml(request.productUrl) : '';

        return `
            <p>Hello,</p>
            <p>The resource request submitted by <strong>${this.escapeHtml(request.employeeName || 'Employee')}</strong>
               has changed from <strong>${previous}</strong> to <strong>${status}</strong>.</p>
            <h3>Request details</h3>
            <ul>
                <li><strong>Title:</strong> ${this.escapeHtml(request.title)}</li>
                <li><strong>Category:</strong> ${this.escapeHtml(request.category)}</li>
                <li><strong>Description:</strong> ${this.escapeHtml(request.description || 'Not provided')}</li>
                <li><strong>Goal Alignment:</strong> ${this.escapeHtml(request.goalAlignment || 'Not provided')}</li>
                <li><strong>Priority:</strong> ${this.escapeHtml(this.formatLabel(request.priority || 'normal'))}</li>
                <li><strong>Estimated Cost:</strong> ${request.estimatedCost !== undefined ? `$${this.escapeHtml(request.estimatedCost)}` : 'Not provided'}</li>
                <li><strong>Product URL:</strong> ${productUrl ? `<a href="${productUrl}">${productUrl}</a>` : 'Not provided'}</li>
                <li><strong>Attachments:</strong> ${attachments ? `${attachments} file${attachments === 1 ? '' : 's'}` : 'None'}</li>
                <li><strong>Status:</strong> ${status}</li>
                <li><strong>Reviewer Note:</strong> ${this.escapeHtml(reviewerNote || request.reviewerNote || 'Not provided')}</li>
            </ul>
            <p>Please review the request in the HR portal if further action is required.</p>
        `;
    }

    private formatLabel(value: string): string {
        return value
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    private escapeHtml(value: unknown): string {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private async notifyApprovers(companyId: string, employeeId: string, subject: string, html: string) {
        const recipientsMap = new Map<string, string>();

        // 1. Get company admins & owners
        const adminsRes = await this.pg.query(
            `SELECT email, name FROM employees e JOIN users u ON e.user_id = u.id WHERE u.company_id = $1 AND u.role IN ('admin', 'owner')`,
            [companyId]
        );
        adminsRes.rows.forEach((r: any) => recipientsMap.set(r.email, r.name));

        // 2. Get the employee's reporting manager
        const managerRes = await this.pg.query(
            `SELECT m.email, m.name FROM employees e 
             JOIN employees m ON e.reporting_manager_id = m.id 
             WHERE e.id = $1 AND e.company_id = $2`,
            [employeeId, companyId]
        );
        if (managerRes.rowCount > 0) {
            const manager = managerRes.rows[0] as any;
            recipientsMap.set(manager.email, manager.name);
        }

        const recipients = Array.from(recipientsMap.entries()).map(([email, name]) => ({ email, name }));

        if (recipients.length > 0) {
            await this.emailService.sendEmail(recipients, subject, html);
        }
    }
}

@Controller('resource-requests')
@UseGuards(AuthGuard, CompanyGuard)
export class ResourceRequestsController {
    constructor(private readonly service: ResourceRequestsService) { }

    @Post()
    async create(@Req() req: any, @Body() data: any) {
        const validated = ResourceRequestSchema.parse(data);
        return this.service.create(req.user.companyId, req.user.employeeId, validated);
    }

    @Get()
    async findAll(@Req() req: any) {
        if (req.user.role === 'admin' || req.user.role === 'owner') {
            return this.service.findAllForCompany(req.user.companyId);
        }
        return this.service.findAllForEmployee(req.user.companyId, req.user.employeeId);
    }

    @Get(':id')
    async findOne(@Req() req: any, @Param('id') id: string) {
        const item = await this.service.findOne(req.user.companyId, id);
        // Members can only see their own
        if (req.user.role === 'member' && item.employeeId !== req.user.employeeId) {
            throw new ForbiddenException('Access denied');
        }
        return item;
    }

    @Put(':id')
    async update(@Req() req: any, @Param('id') id: string, @Body() data: any) {
        const validated = ResourceRequestSchema.partial().parse(data);
        return this.service.update(req.user.companyId, req.user.employeeId, id, validated);
    }

    @Patch(':id/status')
    async patchStatus(@Req() req: any, @Param('id') id: string, @Body() data: any) {
        if (req.user.role !== 'admin' && req.user.role !== 'owner') {
            throw new ForbiddenException('Only admins can update status');
        }
        const validated = ResourceRequestStatusPatchSchema.parse(data);
        return this.service.patchStatus(req.user.companyId, req.user.employeeId, id, validated.status, validated.reviewerNote);
    }

    @Delete(':id')
    async remove(@Req() req: any, @Param('id') id: string) {
        const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
        await this.service.remove(req.user.companyId, req.user.employeeId, id, isAdmin);
        return { success: true };
    }
}

@Controller('resource-categories')
export class ResourceCategoriesController {
    @Get()
    findAll() {
        return RESOURCE_CATEGORIES;
    }
}

@Module({
    controllers: [ResourceRequestsController, ResourceCategoriesController],
    providers: [ResourceRequestsService],
})
export class ResourceRequestsModule { }
