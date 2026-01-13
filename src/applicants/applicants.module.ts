import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Applicant, ApplicantSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class ApplicantsService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'job_id AS "jobId"',
        'full_name AS "fullName"',
        'email',
        'phone',
        'position_applied AS "positionApplied"',
        'years_of_experience AS "yearsOfExperience"',
        'current_salary AS "currentSalary"',
        'expected_salary AS "expectedSalary"',
        'notice_period AS "noticePeriod"',
        'resume_file AS "resumeFile"',
        'linkedin_url AS "linkedinUrl"',
        'status',
        'applied_date AS "appliedDate"',
        'documents',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Applicant) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Applicant>(
            `INSERT INTO applicants (
                id,
                company_id,
                job_id,
                full_name,
                email,
                phone,
                position_applied,
                years_of_experience,
                current_salary,
                expected_salary,
                notice_period,
                resume_file,
                linkedin_url,
                status,
                applied_date,
                documents
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.jobId ?? null,
                data.fullName,
                data.email,
                data.phone ?? null,
                data.positionApplied ?? null,
                data.yearsOfExperience ?? null,
                data.currentSalary ?? null,
                data.expectedSalary ?? null,
                data.noticePeriod ?? null,
                data.resumeFile ?? null,
                data.linkedinUrl ?? null,
                data.status,
                data.appliedDate,
                data.documents ?? null,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<Applicant>(
            `SELECT ${this.selectFields}
             FROM applicants
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<Applicant>(
            `SELECT ${this.selectFields}
             FROM applicants
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, data: Partial<Applicant>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (Object.prototype.hasOwnProperty.call(data, 'jobId')) {
            updates.push(`job_id = $${index++}`);
            values.push(data.jobId ?? null);
        }
        if (data.fullName !== undefined) {
            updates.push(`full_name = $${index++}`);
            values.push(data.fullName);
        }
        if (data.email !== undefined) {
            updates.push(`email = $${index++}`);
            values.push(data.email);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
            updates.push(`phone = $${index++}`);
            values.push(data.phone ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'positionApplied')) {
            updates.push(`position_applied = $${index++}`);
            values.push(data.positionApplied ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'yearsOfExperience')) {
            updates.push(`years_of_experience = $${index++}`);
            values.push(data.yearsOfExperience ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'currentSalary')) {
            updates.push(`current_salary = $${index++}`);
            values.push(data.currentSalary ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'expectedSalary')) {
            updates.push(`expected_salary = $${index++}`);
            values.push(data.expectedSalary ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'noticePeriod')) {
            updates.push(`notice_period = $${index++}`);
            values.push(data.noticePeriod ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'resumeFile')) {
            updates.push(`resume_file = $${index++}`);
            values.push(data.resumeFile ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'linkedinUrl')) {
            updates.push(`linkedin_url = $${index++}`);
            values.push(data.linkedinUrl ?? null);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${index++}`);
            values.push(data.status);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'appliedDate')) {
            updates.push(`applied_date = $${index++}`);
            values.push(data.appliedDate ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'documents')) {
            updates.push(`documents = $${index++}`);
            values.push(data.documents ?? null);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Applicant>(
            `UPDATE applicants
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM applicants WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('applicants')
@UseGuards(AuthGuard, CompanyGuard)
export class ApplicantsController {
    constructor(private service: ApplicantsService) { }

    @Post()
    create(@Body() data: Applicant, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = ApplicantSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as Applicant);
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
    update(@Param('id') id: string, @Body() data: Partial<Applicant>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Applicant>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [ApplicantsController],
    providers: [ApplicantsService],
    exports: [ApplicantsService]
})
export class ApplicantsModule { }
