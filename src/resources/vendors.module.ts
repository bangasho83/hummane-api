import {
    Module,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Req,
    Query,
    UseGuards,
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { PostgresService } from '../postgres/postgres.service';
import { parseLimit } from '../utils/pagination';
import { Vendor, VendorSchema } from '../schemas/hr.schema';

@Injectable()
export class VendorsService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'name',
        'contact_name AS "contactName"',
        'email',
        'phone',
        'is_active AS "isActive"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Vendor) {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Vendor>(
            `INSERT INTO vendors (id, company_id, name, contact_name, email, phone, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.name,
                data.contactName ?? null,
                data.email || null,
                data.phone ?? null,
                data.isActive ?? true,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<Vendor>(
            `SELECT ${this.selectFields}
             FROM vendors
             WHERE company_id = $1
             ORDER BY name ASC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<Vendor>(
            `SELECT ${this.selectFields}
             FROM vendors
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        if (result.rowCount === 0) {
            throw new NotFoundException('Vendor not found');
        }
        return result.rows[0];
    }

    async update(id: string, data: Partial<Vendor>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(data.name);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'contactName')) {
            updates.push(`contact_name = $${index++}`);
            values.push(data.contactName ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'email')) {
            updates.push(`email = $${index++}`);
            values.push(data.email || null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
            updates.push(`phone = $${index++}`);
            values.push(data.phone ?? null);
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${index++}`);
            values.push(data.isActive);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Vendor>(
            `UPDATE vendors
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        if (result.rowCount === 0) {
            throw new NotFoundException('Vendor not found');
        }
        return result.rows[0];
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM vendors WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('vendors')
@UseGuards(AuthGuard, CompanyGuard)
export class VendorsController {
    constructor(private service: VendorsService) { }

    @Post()
    create(@Body() data: Vendor, @Req() req: any) {
        data.companyId = req.user.companyId;
        const v = VendorSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }
        return this.service.create(v.data as Vendor);
    }

    @Get()
    findAll(@Req() req: any, @Query('limit') limit?: string) {
        return this.service.findAll(req.user.companyId, parseLimit(limit));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Vendor>, @Req() req: any) {
        const updateData = { ...data };
        delete (updateData as Partial<Vendor>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: any) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [VendorsController],
    providers: [VendorsService],
    exports: [VendorsService],
})
export class VendorsModule { }
