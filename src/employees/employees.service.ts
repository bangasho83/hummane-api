import { Injectable } from '@nestjs/common';
import { Employee } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class EmployeesService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'employee_id AS "employeeId"',
        'company_id AS "companyId"',
        'user_id AS "userId"',
        'name',
        'email',
        'department_id AS "departmentId"',
        'role_id AS "roleId"',
        'start_date AS "startDate"',
        'employment_type AS "employmentType"',
        'reporting_manager_id AS "reportingManagerId"',
        'gender',
        'salary',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Employee): Promise<Employee> {
        const id = data.id || uuidv4();
        const result = await this.postgres.query<Employee>(
            `INSERT INTO employees (
                id,
                employee_id,
                company_id,
                user_id,
                name,
                email,
                department_id,
                role_id,
                start_date,
                employment_type,
                reporting_manager_id,
                gender,
                salary
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING ${this.selectFields}`,
            [
                id,
                data.employeeId,
                data.companyId,
                data.userId ?? null,
                data.name,
                data.email,
                data.departmentId ?? null,
                data.roleId ?? null,
                data.startDate,
                data.employmentType,
                data.reportingManagerId ?? null,
                data.gender,
                data.salary ?? null,
            ],
        );
        return result.rows[0];
    }

    async findAll(companyId: string, limit = 50): Promise<Employee[]> {
        const result = await this.postgres.query<Employee>(
            `SELECT ${this.selectFields}
             FROM employees
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string): Promise<Employee | null> {
        const result = await this.postgres.query<Employee>(
            `SELECT ${this.selectFields}
             FROM employees
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }

    async update(id: string, updateData: Partial<Employee>, companyId: string): Promise<Employee | null> {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (updateData.employeeId !== undefined) {
            updates.push(`employee_id = $${index++}`);
            values.push(updateData.employeeId);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'userId')) {
            updates.push(`user_id = $${index++}`);
            values.push(updateData.userId ?? null);
        }
        if (updateData.name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(updateData.name);
        }
        if (updateData.email !== undefined) {
            updates.push(`email = $${index++}`);
            values.push(updateData.email);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'departmentId')) {
            updates.push(`department_id = $${index++}`);
            values.push(updateData.departmentId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'roleId')) {
            updates.push(`role_id = $${index++}`);
            values.push(updateData.roleId ?? null);
        }
        if (updateData.startDate !== undefined) {
            updates.push(`start_date = $${index++}`);
            values.push(updateData.startDate);
        }
        if (updateData.employmentType !== undefined) {
            updates.push(`employment_type = $${index++}`);
            values.push(updateData.employmentType);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'reportingManagerId')) {
            updates.push(`reporting_manager_id = $${index++}`);
            values.push(updateData.reportingManagerId ?? null);
        }
        if (updateData.gender !== undefined) {
            updates.push(`gender = $${index++}`);
            values.push(updateData.gender);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'salary')) {
            updates.push(`salary = $${index++}`);
            values.push(updateData.salary ?? null);
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<Employee>(
            `UPDATE employees
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        return result.rows[0] ?? null;
    }

    async delete(id: string, companyId: string): Promise<void> {
        await this.postgres.query(
            `DELETE FROM employees WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}
