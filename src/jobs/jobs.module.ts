import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Job, JobSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class JobsService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'j.id',
        'j.company_id AS "companyId"',
        'j.title',
        'j.role_id AS "roleId"',
        'r.title AS "roleName"',
        'j.department_id AS "departmentId"',
        'd.name AS "departmentName"',
        'j.employment_type AS "employmentType"',
        'j.employment_mode AS "employmentMode"',
        'j.city',
        'j.country',
        'j.salary_from AS "salaryFrom"',
        'j.salary_to AS "salaryTo"',
        'j.experience',
        'j.status',
        '(SELECT COUNT(*)::int FROM applicants a WHERE a.job_id = j.id) AS "applicantCount"',
        'j.created_at AS "createdAt"',
        'j.updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Job) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Job>(
            `INSERT INTO jobs (
                id,
                company_id,
                title,
                role_id,
                department_id,
                employment_type,
                employment_mode,
                city,
                country,
                salary_from,
                salary_to,
                experience,
                status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING id`,
            [
                id,
                data.companyId,
                data.title,
                data.roleId ?? null,
                data.departmentId ?? null,
                data.employmentType ?? null,
                data.employmentMode ?? null,
                data.city ?? null,
                data.country ?? null,
                data.salaryFrom ?? null,
                data.salaryTo ?? null,
                data.experience ?? null,
                data.status,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<Job>(
            `SELECT ${this.selectFields}
             FROM jobs j
             LEFT JOIN roles r ON r.id = j.role_id AND r.company_id = j.company_id
             LEFT JOIN departments d ON d.id = j.department_id AND d.company_id = j.company_id
             WHERE j.company_id = $1
             ORDER BY j.created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<Job>(
            `SELECT ${this.selectFields}
             FROM jobs j
             LEFT JOIN roles r ON r.id = j.role_id AND r.company_id = j.company_id
             LEFT JOIN departments d ON d.id = j.department_id AND d.company_id = j.company_id
             WHERE j.id = $1 AND j.company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, data: Partial<Job>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (data.title !== undefined) {
            updates.push(`title = $${index++}`);
            values.push(data.title);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'roleId')) {
            updates.push(`role_id = $${index++}`);
            values.push(data.roleId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'departmentId')) {
            updates.push(`department_id = $${index++}`);
            values.push(data.departmentId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'employmentType')) {
            updates.push(`employment_type = $${index++}`);
            values.push(data.employmentType ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'employmentMode')) {
            updates.push(`employment_mode = $${index++}`);
            values.push(data.employmentMode ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'city')) {
            updates.push(`city = $${index++}`);
            values.push(data.city ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'country')) {
            updates.push(`country = $${index++}`);
            values.push(data.country ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'salaryFrom')) {
            updates.push(`salary_from = $${index++}`);
            values.push(data.salaryFrom ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'salaryTo')) {
            updates.push(`salary_to = $${index++}`);
            values.push(data.salaryTo ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'experience')) {
            updates.push(`experience = $${index++}`);
            values.push(data.experience ?? null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${index++}`);
            values.push(data.status);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Job>(
            `UPDATE jobs
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM jobs WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('jobs')
@UseGuards(AuthGuard, CompanyGuard)
export class JobsController {
    constructor(private service: JobsService) { }

    @Post()
    create(@Body() data: Job, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = JobSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as Job);
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
    update(@Param('id') id: string, @Body() data: Partial<Job>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Job>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [JobsController],
    providers: [JobsService],
    exports: [JobsService]
})
export class JobsModule { }
