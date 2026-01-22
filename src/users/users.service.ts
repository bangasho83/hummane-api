import { Injectable } from '@nestjs/common';
import { User, UserSchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class UsersService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'name',
        'email',
        'password',
        'company_id AS "companyId"',
        'role',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(userData: User): Promise<User> {
        const id = userData.id || uuidv4();
        const result = await this.postgres.query<User>(
            `INSERT INTO users (id, name, email, password, company_id, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${this.selectFields}`,
            [
                id,
                userData.name,
                userData.email,
                userData.password ?? null,
                userData.companyId ?? null,
                userData.role ?? 'member',
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId?: string, limit = 50): Promise<User[]> {
        const params: unknown[] = [];
        let whereClause = '';
        if (companyId) {
            params.push(companyId);
            whereClause = `WHERE company_id = $${params.length}`;
        }
        params.push(limit);
        const limitParam = `$${params.length}`;
        const result = await this.postgres.query<User>(
            `SELECT ${this.selectFields}
             FROM users
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ${limitParam}`,
            params,
        );
        return result.rows;
    }

    async findOne(id: string): Promise<User | null> {
        const result = await this.postgres.query<User>(
            `SELECT ${this.selectFields} FROM users WHERE id = $1 LIMIT 1`,
            [id],
        );
        return result.rows[0] ?? null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const result = await this.postgres.query<User>(
            `SELECT ${this.selectFields} FROM users WHERE email = $1 LIMIT 1`,
            [email],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, updateData: Partial<User>): Promise<User | null> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (updateData.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(updateData.name);
        }
        if (updateData.email !== undefined) {
            updates.push(`email = $${index++}`);
            values.push(updateData.email);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'password')) {
            updates.push(`password = $${index++}`);
            values.push(updateData.password ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'companyId')) {
            updates.push(`company_id = $${index++}`);
            values.push(updateData.companyId ?? null);
        }
        if (updateData.role !== undefined) {
            updates.push(`role = $${index++}`);
            values.push(updateData.role);
        }

        updates.push('updated_at = now()');
        values.push(id);

        const result = await this.postgres.query<User>(
            `UPDATE users
             SET ${updates.join(', ')}
             WHERE id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string): Promise<void> {
        await this.postgres.query(`DELETE FROM users WHERE id = $1`, [id]);
    }
}
