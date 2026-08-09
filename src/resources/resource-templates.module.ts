import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { PostgresService } from '../postgres/postgres.service';
import {
    ResourceTemplate,
    ResourceTemplateSchema,
    ResourceTemplateUpdateSchema,
} from '../schemas/hr.schema';
import { RESOURCE_CATEGORIES } from './resource-categories.constants';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class ResourceTemplatesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'name',
        'resource_type AS "resourceType"',
        'category',
        'description',
        'vendor_id AS "vendorId"',
        'default_cost_amount AS "defaultCostAmount"',
        'default_cost_type AS "defaultCostType"',
        'default_details AS "defaultDetails"',
        'is_active AS "isActive"',
        'created_by AS "createdBy"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    private validateCategory(category: string) {
        if (!RESOURCE_CATEGORIES.some((item) => item.name === category)) {
            throw new BadRequestException('Invalid category');
        }
    }

    async create(data: ResourceTemplate) {
        this.validateCategory(data.category);
        const result = await this.postgres.query<ResourceTemplate>(
            `INSERT INTO resource_templates (
                id, company_id, name, resource_type, category, description, vendor_id,
                default_cost_amount, default_cost_type, default_details, is_active, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING ${this.selectFields}`,
            [
                data.id || uuidv4(),
                data.companyId,
                data.name,
                data.resourceType,
                data.category,
                data.description ?? null,
                data.vendorId || null,
                data.defaultCostAmount ?? null,
                data.defaultCostType ?? 'recurring',
                JSON.stringify(data.defaultDetails ?? {}),
                data.isActive ?? true,
                data.createdBy || null,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit: number, activeOnly = false) {
        const activeClause = activeOnly ? ' AND is_active = true' : '';
        const result = await this.postgres.query<ResourceTemplate>(
            `SELECT ${this.selectFields}
             FROM resource_templates
             WHERE company_id = $1${activeClause}
             ORDER BY name ASC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<ResourceTemplate>(
            `SELECT ${this.selectFields}
             FROM resource_templates
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        if (result.rowCount === 0) throw new NotFoundException('Resource template not found');
        return result.rows[0];
    }

    async update(id: string, data: Partial<ResourceTemplate>, companyId: string) {
        if (data.category !== undefined) this.validateCategory(data.category);
        const columnMap: Record<string, string> = {
            name: 'name',
            resourceType: 'resource_type',
            category: 'category',
            description: 'description',
            vendorId: 'vendor_id',
            defaultCostAmount: 'default_cost_amount',
            defaultCostType: 'default_cost_type',
            isActive: 'is_active',
        };
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;
        for (const [key, column] of Object.entries(columnMap)) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
            const value = (data as Record<string, unknown>)[key];
            updates.push(`${column} = $${index++}`);
            values.push(key === 'vendorId' ? value || null : value ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'defaultDetails')) {
            updates.push(`default_details = $${index++}`);
            values.push(JSON.stringify(data.defaultDetails ?? {}));
        }
        if (!updates.length) return this.findOne(id, companyId);
        updates.push('updated_at = now()');
        values.push(id, companyId);
        const result = await this.postgres.query<ResourceTemplate>(
            `UPDATE resource_templates
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        if (result.rowCount === 0) throw new NotFoundException('Resource template not found');
        return result.rows[0];
    }

    async archive(id: string, companyId: string) {
        return this.update(id, { isActive: false }, companyId);
    }
}

@Controller('resource-templates')
@UseGuards(AuthGuard, CompanyGuard)
export class ResourceTemplatesController {
    constructor(private service: ResourceTemplatesService) { }

    private assertOwner(req: any) {
        if (req.user.role !== 'owner') throw new ForbiddenException('Only company owners can manage resource templates');
    }

    @Post()
    create(@Body() data: ResourceTemplate, @Req() req: any) {
        this.assertOwner(req);
        const result = ResourceTemplateSchema.safeParse({
            ...data,
            companyId: req.user.companyId,
            createdBy: data.createdBy || req.user.employeeId,
        });
        if (!result.success) throw new BadRequestException(result.error.issues);
        return this.service.create(result.data as ResourceTemplate);
    }

    @Get()
    findAll(@Req() req: any, @Query('limit') limit?: string, @Query('activeOnly') activeOnly?: string) {
        return this.service.findAll(req.user.companyId, parseLimit(limit), activeOnly === 'true');
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<ResourceTemplate>, @Req() req: any) {
        this.assertOwner(req);
        const updateData = { ...data };
        delete (updateData as Partial<ResourceTemplate>).companyId;
        delete (updateData as Partial<ResourceTemplate>).createdBy;
        const result = ResourceTemplateUpdateSchema.safeParse(updateData);
        if (!result.success) throw new BadRequestException(result.error.issues);
        return this.service.update(id, result.data as Partial<ResourceTemplate>, req.user.companyId);
    }

    @Delete(':id')
    archive(@Param('id') id: string, @Req() req: any) {
        this.assertOwner(req);
        return this.service.archive(id, req.user.companyId);
    }
}

@Module({
    controllers: [ResourceTemplatesController],
    providers: [ResourceTemplatesService],
    exports: [ResourceTemplatesService],
})
export class ResourceTemplatesModule { }