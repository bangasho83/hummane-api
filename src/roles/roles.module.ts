import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Role, RoleSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class RolesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'title',
        'description',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Role) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Role>(
            `INSERT INTO roles (id, company_id, title, description)
             VALUES ($1, $2, $3, $4)
             RETURNING ${this.selectFields}`,
            [id, data.companyId, data.title, data.description ?? null],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<Role>(
            `SELECT ${this.selectFields}
             FROM roles
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<Role>(
            `SELECT ${this.selectFields}
             FROM roles
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, data: Partial<Role>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (data.title !== undefined) {
            updates.push(`title = $${index++}`);
            values.push(data.title);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'description')) {
            updates.push(`description = $${index++}`);
            values.push(data.description ?? null);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Role>(
            `UPDATE roles
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM roles WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('roles')
@UseGuards(AuthGuard, CompanyGuard)
export class RolesController {
    constructor(private service: RolesService) { }

    @Post()
    create(@Body() data: Role, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = RoleSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as Role);
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
    update(@Param('id') id: string, @Body() data: Partial<Role>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Role>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService]
})
export class RolesModule { }
