import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { Company, CompanySchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class CompaniesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'owner_id AS "ownerId"',
        'name',
        'industry',
        'size',
        'currency',
        'timezone',
        'working_hours AS "workingHours"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(companyData: Company): Promise<Company> {
        const id = companyData.id || uuidv4();
        const result = await this.postgres.withTransaction(async (client) => {
            const insert = await client.query<Company>(
                `INSERT INTO companies (id, owner_id, name, industry, size, currency, timezone, working_hours)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING ${this.selectFields}`,
                [
                    id,
                    companyData.ownerId,
                    companyData.name,
                    companyData.industry ?? null,
                    companyData.size ?? null,
                    companyData.currency ?? null,
                    companyData.timezone ?? null,
                    companyData.workingHours ?? null,
                ],
            );

            if (companyData.ownerId) {
                console.log(`[CompaniesInfo] Linking owner ${companyData.ownerId} to new company ${id}`);
                await client.query(
                    `UPDATE users SET company_id = $1, updated_at = now() WHERE id = $2`,
                    [id, companyData.ownerId],
                );
            }

            return insert.rows[0];
        });

        return result;
    }

    async findAll(): Promise<Company[]> {
        const result = await this.postgres.query<Company>(
            `SELECT ${this.selectFields} FROM companies ORDER BY created_at DESC`,
        );
        return result.rows;
    }

    async findOne(id: string): Promise<Company | null> {
        const result = await this.postgres.query<Company>(
            `SELECT ${this.selectFields} FROM companies WHERE id = $1 LIMIT 1`,
            [id],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, updateData: Partial<Company>): Promise<Company | null> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (updateData.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(updateData.name);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'ownerId')) {
            updates.push(`owner_id = $${index++}`);
            values.push(updateData.ownerId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'industry')) {
            updates.push(`industry = $${index++}`);
            values.push(updateData.industry ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'size')) {
            updates.push(`size = $${index++}`);
            values.push(updateData.size ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'currency')) {
            updates.push(`currency = $${index++}`);
            values.push(updateData.currency ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'timezone')) {
            updates.push(`timezone = $${index++}`);
            values.push(updateData.timezone ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'workingHours')) {
            updates.push(`working_hours = $${index++}`);
            values.push(updateData.workingHours ?? null);
        }

        updates.push('updated_at = now()');
        values.push(id);

        const result = await this.postgres.query<Company>(
            `UPDATE companies
             SET ${updates.join(', ')}
             WHERE id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );

        return result.rows[0] ?? null;
    }

    async delete(id: string): Promise<void> {
        await this.postgres.query(`DELETE FROM companies WHERE id = $1`, [id]);
    }

    async findByOwner(userId: string): Promise<Company | null> {
        const result = await this.postgres.query<Company>(
            `SELECT ${this.selectFields} FROM companies WHERE owner_id = $1 LIMIT 1`,
            [userId],
        );
        return result.rows[0] ?? null;
    }

    async generateApiKey(companyId: string): Promise<string> {
        const apiKey = crypto.randomBytes(32).toString('hex');
        await this.postgres.query(
            `UPDATE companies SET api_key = $1, updated_at = now() WHERE id = $2`,
            [apiKey, companyId],
        );
        return apiKey;
    }

    async getApiKey(companyId: string): Promise<string | null> {
        const result = await this.postgres.query<{ api_key: string }>(
            `SELECT api_key FROM companies WHERE id = $1 LIMIT 1`,
            [companyId],
        );
        return result.rows[0]?.api_key ?? null;
    }
}
