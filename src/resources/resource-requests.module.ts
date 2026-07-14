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
        return this.pg.withTransaction(async (client) => {
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

            // Notify Admin
            this.notifyAdmins(companyId, `New resource request from ${empName}`, `
                <p><strong>${empName}</strong> has submitted a new resource request.</p>
                <p><strong>Title:</strong> ${data.title}</p>
                <p><strong>Category:</strong> ${data.category}</p>
                <p>Please review it in the HR portal.</p>
            `);

            return this.mapToCamelCase(result.rows[0]);
        });
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
        return this.pg.withTransaction(async (client) => {
            const existingRes = await client.query(
                `SELECT * FROM resource_requests WHERE id = $1 AND company_id = $2`,
                [id, companyId]
            );
            if (existingRes.rowCount === 0) {
                throw new NotFoundException('Resource request not found');
            }
            const existing = existingRes.rows[0];

            if (existing.status === status) {
                return this.mapToCamelCase(existing);
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

            // Notify Employee
            let subject = '';
            let message = '';
            if (status === 'approved') {
                subject = 'Your resource request has been approved';
                message = `Your request for <strong>${existing.title}</strong> has been approved.`;
            } else if (status === 'rejected') {
                subject = 'Update on your resource request';
                message = `Your request for <strong>${existing.title}</strong> has been rejected.`;
                if (reviewerNote) message += `<br>Reason: ${reviewerNote}`;
            } else if (status === 'fulfilled') {
                subject = 'Your resource request has been fulfilled';
                message = `Your request for <strong>${existing.title}</strong> has been fulfilled.`;
            }

            if (subject && existing.employee_email) {
                this.emailService.sendEmail(
                    { email: existing.employee_email, name: existing.employee_name },
                    subject,
                    `<p>Hi ${existing.employee_name},</p><p>${message}</p>`
                );
            }

            return this.mapToCamelCase(result.rows[0]);
        });
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

    private async notifyAdmins(companyId: string, subject: string, html: string) {
        // Ideally we fetch admin emails here. For simplicity, we just log or broadcast to an admin group.
        // If there's an 'owner' or 'admin' role in users:
        const adminsRes = await this.pg.query(
            `SELECT email, name FROM employees e JOIN users u ON e.user_id = u.id WHERE u.company_id = $1 AND u.role IN ('admin', 'owner')`,
            [companyId]
        );
        const adminRecipients = adminsRes.rows.map((r: any) => ({ email: r.email, name: r.name }));
        if (adminRecipients.length > 0) {
            this.emailService.sendEmail(adminRecipients, subject, html);
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
