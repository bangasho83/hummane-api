import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Holiday, HolidaySchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class HolidaysService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'date',
        'name',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Holiday) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Holiday>(
            `INSERT INTO holidays (id, company_id, date, name)
             VALUES ($1, $2, $3, $4)
             RETURNING ${this.selectFields}`,
            [id, data.companyId, data.date, data.name],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<Holiday>(
            `SELECT ${this.selectFields}
             FROM holidays
             WHERE company_id = $1
             ORDER BY date ASC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<Holiday>(
            `SELECT ${this.selectFields}
             FROM holidays
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, data: Partial<Holiday>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (Object.prototype.hasOwnProperty.call(data, 'date')) {
            updates.push(`date = $${index++}`);
            values.push(data.date ?? null);
        }
        if (data.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(data.name);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Holiday>(
            `UPDATE holidays
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM holidays WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('holidays')
@UseGuards(AuthGuard, CompanyGuard)
export class HolidaysController {
    constructor(private service: HolidaysService) { }

    @Post()
    create(@Body() data: Holiday, @Req() req) {
        const user = req.user;
        data.companyId = user.companyId;

        const v = HolidaySchema.safeParse(data);
        if (!v.success) throw new BadRequestException(v.error.issues);
        return this.service.create(data);
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
    update(@Param('id') id: string, @Body() data: Partial<Holiday>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Holiday>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [HolidaysController],
    providers: [HolidaysService],
    exports: [HolidaysService]
})
export class HolidaysModule { }
