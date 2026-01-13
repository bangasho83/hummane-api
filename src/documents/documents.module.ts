import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { EmployeeDocument, EmployeeDocumentSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class DocumentsService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'employee_id AS "employeeId"',
        'name',
        'document_kind AS "type"',
        'data_url AS "dataUrl"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: EmployeeDocument) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<EmployeeDocument>(
            `INSERT INTO employee_documents (id, company_id, employee_id, name, document_kind, data_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.employeeId,
                data.name,
                data.type,
                data.dataUrl ?? null,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, employeeId?: string, limit = 50) {
        const params: unknown[] = [companyId];
        let whereClause = 'company_id = $1';
        if (employeeId) {
            params.push(employeeId);
            whereClause += ` AND employee_id = $${params.length}`;
        }
        params.push(limit);
        const limitParam = `$${params.length}`;

        const result = await this.postgres.query<EmployeeDocument>(
            `SELECT ${this.selectFields}
             FROM employee_documents
             WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT ${limitParam}`,
            params,
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<EmployeeDocument>(
            `SELECT ${this.selectFields}
             FROM employee_documents
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM employee_documents WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('documents')
@UseGuards(AuthGuard, CompanyGuard)
export class DocumentsController {
    constructor(private service: DocumentsService) { }

    @Post()
    create(@Body() data: EmployeeDocument, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = EmployeeDocumentSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as EmployeeDocument);
    }

    @Get()
    findAll(@Query('employeeId') eid: string, @Query('limit') limit: string, @Req() req) {
        return this.service.findAll(req.user.companyId, eid, parseLimit(limit));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [DocumentsController],
    providers: [DocumentsService],
    exports: [DocumentsService]
})
export class DocumentsModule { }
