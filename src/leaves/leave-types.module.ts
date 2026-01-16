import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { LeaveType, LeaveTypeSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class LeaveTypesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'name',
        'code',
        'unit',
        'quota',
        'employment_type AS "employmentType"',
        'color',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: LeaveType) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<LeaveType>(
            `INSERT INTO leave_types (id, company_id, name, code, unit, quota, employment_type, color)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.name,
                data.code ?? null,
                data.unit,
                data.quota,
                data.employmentType ?? null,
                data.color ?? null,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<LeaveType>(
            `SELECT ${this.selectFields}
             FROM leave_types
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<LeaveType>(
            `SELECT ${this.selectFields}
             FROM leave_types
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, data: Partial<LeaveType>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(data.name);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'code')) {
            updates.push(`code = $${index++}`);
            values.push(data.code ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'unit')) {
            updates.push(`unit = $${index++}`);
            values.push(data.unit ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'quota')) {
            updates.push(`quota = $${index++}`);
            values.push(data.quota ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'employmentType')) {
            updates.push(`employment_type = $${index++}`);
            values.push(data.employmentType ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'color')) {
            updates.push(`color = $${index++}`);
            values.push(data.color ?? null);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<LeaveType>(
            `UPDATE leave_types
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM leave_types WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('leave-types')
@UseGuards(AuthGuard, CompanyGuard)
export class LeaveTypesController {
    constructor(private service: LeaveTypesService) { }

    @Post()
    create(@Body() data: LeaveType, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = LeaveTypeSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as LeaveType);
    }

    @Get()
    findAll(@Req() req, @Query('limit') limit?: string) {
        return this.service.findAll(req.user.companyId, parseLimit(limit));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<LeaveType>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<LeaveType>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [LeaveTypesController],
    providers: [LeaveTypesService],
    exports: [LeaveTypesService]
})
export class LeaveTypesModule { }
