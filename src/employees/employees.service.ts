import { Injectable } from '@nestjs/common';
import { Employee } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class EmployeesService {
    constructor(private postgres: PostgresService) { }

    private normalizeOptionalUuid(value?: string | null) {
        if (value === '') return null;
        return value ?? null;
    }

    private selectFields = [
        'e.id',
        'e.employee_id AS "employeeId"',
        'e.company_id AS "companyId"',
        'e.user_id AS "userId"',
        'e.name',
        'e.email',
        'e.department_id AS "departmentId"',
        'd.name AS "departmentName"',
        'e.role_id AS "roleId"',
        'r.title AS "roleName"',
        'e.start_date AS "startDate"',
        'e.employment_type AS "employmentType"',
        'e.employment_mode AS "employmentMode"',
        'e.reporting_manager_id AS "reportingManagerId"',
        'm.name AS "reportingManagerName"',
        'e.gender',
        'e.salary',
        'e.created_at AS "createdAt"',
        'e.updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: Employee): Promise<Employee> {
        const id = data.id || uuidv4();
        await this.postgres.query<{ id: string }>(
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
                employment_mode,
                reporting_manager_id,
                gender,
                salary
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING id`,
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
                data.employmentMode ?? null,
                data.reportingManagerId ?? null,
                data.gender,
                data.salary ?? null,
            ],
        );
        return this.findOne(id, data.companyId) as Promise<Employee>;
    }

    async findAll(companyId: string, limit = 50): Promise<Employee[]> {
        const result = await this.postgres.query<Employee>(
            `SELECT ${this.selectFields}
             FROM employees e
             LEFT JOIN departments d
               ON d.id = e.department_id AND d.company_id = e.company_id
             LEFT JOIN roles r
               ON r.id = e.role_id AND r.company_id = e.company_id
             LEFT JOIN employees m
               ON m.id = e.reporting_manager_id AND m.company_id = e.company_id
             WHERE e.company_id = $1
             ORDER BY e.created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }

    async findOne(id: string, companyId: string): Promise<Employee | null> {
        const result = await this.postgres.query<Employee>(
            `SELECT ${this.selectFields}
             FROM employees e
             LEFT JOIN departments d
               ON d.id = e.department_id AND d.company_id = e.company_id
             LEFT JOIN roles r
               ON r.id = e.role_id AND r.company_id = e.company_id
             LEFT JOIN employees m
               ON m.id = e.reporting_manager_id AND m.company_id = e.company_id
             WHERE e.id = $1 AND e.company_id = $2
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
            values.push(this.normalizeOptionalUuid(updateData.userId));
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
            values.push(this.normalizeOptionalUuid(updateData.departmentId));
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'roleId')) {
            updates.push(`role_id = $${index++}`);
            values.push(this.normalizeOptionalUuid(updateData.roleId));
        }
        if (updateData.startDate !== undefined) {
            updates.push(`start_date = $${index++}`);
            values.push(updateData.startDate);
        }
        if (updateData.employmentType !== undefined) {
            updates.push(`employment_type = $${index++}`);
            values.push(updateData.employmentType);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'employmentMode')) {
            updates.push(`employment_mode = $${index++}`);
            values.push(updateData.employmentMode ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(updateData, 'reportingManagerId')) {
            updates.push(`reporting_manager_id = $${index++}`);
            values.push(this.normalizeOptionalUuid(updateData.reportingManagerId));
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

        const result = await this.postgres.query<{ id: string }>(
            `UPDATE employees
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING id`,
            values,
        );
        const updated = result.rows[0];
        if (!updated) return null;
        return this.findOne(id, companyId);
    }

    async delete(id: string, companyId: string): Promise<void> {
        await this.postgres.query(
            `DELETE FROM employees WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}
