import { BadRequestException, InternalServerErrorException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { EmployeesService } from '../employees/employees.service';
import { EmailService } from '../email/email.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { EmployeesModule } from '../employees/employees.module';
import { EmailModule } from '../email/email.module';
import { LeaveDay, LeaveRecord, LeaveRecordSchema, LeaveType } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';
import { PoolClient } from 'pg';

@Injectable()
export class LeaveRecordsService {
    constructor(private postgres: PostgresService) { }

    private leaveDaySelectFields = [
        'ld.id',
        'ld.leave_record_id AS "leaveRecordId"',
        'ld.date',
        'ld.day_of_week AS "dayOfWeek"',
        'ld.is_working_day AS "isWorkingDay"',
        'ld.is_holiday AS "isHoliday"',
        'ld.is_closed AS "isClosed"',
        'ld.counts_toward_quota AS "countsTowardQuota"',
        'lt.color AS "leaveTypeColor"',
        'ld.working_hours AS "workingHours"',
    ].join(', ');

    private throwIfForeignKeyError(error: unknown) {
        const pgError = error as { code?: string; constraint?: string };
        if (pgError?.code !== '23503') {
            return;
        }

        const constraint = pgError.constraint ?? '';
        const messageByConstraint: Record<string, string> = {
            leave_records_company_fk: 'companyId does not exist',
            leave_records_employee_fk: 'employeeId does not exist',
            leave_records_leave_type_fk: 'leaveTypeId does not exist',
            leave_days_company_fk: 'companyId does not exist',
            leave_days_employee_fk: 'employeeId does not exist',
            leave_days_leave_type_fk: 'leaveTypeId does not exist',
            leave_days_leave_record_fk: 'leaveRecordId does not exist',
        };

        throw new BadRequestException({
            message: messageByConstraint[constraint] ?? 'Foreign key constraint failed',
            error: {
                code: pgError.code,
                constraint,
            },
        });
    }

    private formatErrorDetails(error: unknown) {
        const pgError = error as { name?: string; code?: string; message?: string; detail?: string; constraint?: string };
        return {
            name: pgError?.name,
            code: pgError?.code,
            message: pgError?.message,
            detail: pgError?.detail,
            constraint: pgError?.constraint,
        };
    }

    private selectFields = [
        'lr.id',
        'lr.company_id AS "companyId"',
        'lr.employee_id AS "employeeId"',
        'e.name AS "employeeName"',
        'lr.leave_type_id AS "leaveTypeId"',
        'lt.name AS "leaveTypeName"',
        'lt.code AS "leaveTypeCode"',
        'lt.quota AS "leaveTypeQuota"',
        'lt.color AS "leaveTypeColor"',
        'lr.start_date AS "startDate"',
        'lr.end_date AS "endDate"',
        'lr.unit',
        'lr.amount',
        'lr.start_time AS "startTime"',
        'lr.end_time AS "endTime"',
        'lr.note',
        'lr.documents',
        'lr.created_at AS "createdAt"',
        'lr.updated_at AS "updatedAt"',
    ].join(', ');

    private getDateRange(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
            dates.push(current.toISOString().slice(0, 10));
        }
        return dates;
    }

    private getWeekdayKey(dateString: string, timeZone?: string) {
        const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        if (!timeZone) {
            const date = new Date(`${dateString}T00:00:00Z`);
            return weekdayKeys[date.getUTCDay()];
        }

        try {
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' });
            const date = new Date(`${dateString}T12:00:00Z`);
            const weekday = formatter.format(date).toLowerCase();
            return weekdayKeys.includes(weekday) ? weekday : weekdayKeys[date.getUTCDay()];
        } catch (error) {
            const date = new Date(`${dateString}T00:00:00Z`);
            return weekdayKeys[date.getUTCDay()];
        }
    }

    private roundToTwoDecimals(value: number) {
        return Math.round(value * 100) / 100;
    }

    private normalizeDate(value: string | Date) {
        if (value instanceof Date) {
            return value.toISOString().slice(0, 10);
        }
        return value;
    }

    private async deleteLeaveDays(leaveRecordId: string, companyId: string, client: PoolClient) {
        await client.query(
            `DELETE FROM leave_days WHERE leave_record_id = $1 AND company_id = $2`,
            [leaveRecordId, companyId],
        );
    }

    private async writeLeaveDays(leaveDays: LeaveDay[], client: PoolClient) {
        if (!leaveDays.length) return;
        const columns = [
            'id',
            'leave_record_id',
            'company_id',
            'employee_id',
            'leave_type_id',
            'date',
            'day_of_week',
            'unit',
            'amount',
            'is_working_day',
            'is_holiday',
            'is_closed',
            'counts_toward_quota',
            'working_hours',
        ];

        const values: unknown[] = [];
        const rows = leaveDays.map((day, rowIndex) => {
            const offset = rowIndex * columns.length;
            values.push(
                day.id || uuidv4(),
                day.leaveRecordId,
                day.companyId,
                day.employeeId,
                day.leaveTypeId ?? null,
                day.date,
                day.dayOfWeek,
                day.unit,
                day.amount,
                day.isWorkingDay,
                day.isHoliday,
                day.isClosed,
                day.countsTowardQuota,
                day.workingHours ?? null,
            );
            const placeholders = columns.map((_, colIndex) => `$${offset + colIndex + 1}`);
            return `(${placeholders.join(', ')})`;
        });

        await client.query(
            `INSERT INTO leave_days (${columns.join(', ')}) VALUES ${rows.join(', ')}`,
            values,
        );
    }

    private async buildLeaveDays(record: LeaveRecord, client: PoolClient): Promise<LeaveDay[]> {
        const companyResult = await client.query<{ workingHours: Record<string, any>; timezone: string }>(
            `SELECT working_hours AS "workingHours", timezone FROM companies WHERE id = $1 LIMIT 1`,
            [record.companyId],
        );
        const companyData = companyResult.rows[0];
        const workingHours = companyData?.workingHours || null;
        const companyTimeZone = companyData?.timezone;

        const startDate = this.normalizeDate(record.startDate as unknown as string | Date);
        const endDate = this.normalizeDate(record.endDate as unknown as string | Date);

        const holidaysResult = await client.query<{ date: string | Date }>(
            `SELECT date FROM holidays
             WHERE company_id = $1 AND date >= $2 AND date <= $3`,
            [record.companyId, startDate, endDate],
        );
        const holidayDates = new Set(
            holidaysResult.rows.map(row => this.normalizeDate(row.date)),
        );

        const dates = this.getDateRange(startDate, endDate);
        const baseDays = dates.map(date => {
            const weekdayKey = this.getWeekdayKey(date, companyTimeZone);
            const daySchedule = workingHours ? workingHours[weekdayKey] : null;
            const isHoliday = holidayDates.has(date);
            const isClosed = daySchedule ? !daySchedule.open : false;
            const isWorkingDay = !isHoliday && !isClosed;

            return {
                id: uuidv4(),
                leaveRecordId: record.id as string,
                companyId: record.companyId,
                employeeId: record.employeeId,
                leaveTypeId: record.leaveTypeId,
                date,
                dayOfWeek: weekdayKey,
                unit: record.unit,
                isWorkingDay,
                isHoliday,
                isClosed,
                countsTowardQuota: isWorkingDay,
                workingHours: daySchedule || undefined,
            };
        });

        const totalAmount = record.amount ?? 0;
        const isHourly = record.unit === 'Hour';

        return baseDays.map(day => {
            const amount = isHourly
                ? (day.isWorkingDay ? totalAmount : 0)
                : (day.isWorkingDay ? 1 : 0);
            return {
                ...day,
                amount,
            };
        });
    }

    private async attachLeaveDays(records: LeaveRecord[]) {
        if (!records.length) return records;
        const recordIds = records.map(record => record.id) as string[];
        const result = await this.postgres.query<LeaveDay>(
            `SELECT ${this.leaveDaySelectFields}
             FROM leave_days ld
             LEFT JOIN leave_types lt ON lt.id = ld.leave_type_id
             WHERE ld.company_id = $1 AND ld.leave_record_id = ANY($2)
             ORDER BY ld.date ASC`,
            [records[0].companyId, recordIds],
        );

        const grouped = new Map<string, LeaveDay[]>();
        result.rows.forEach(day => {
            const key = day.leaveRecordId as string;
            const compactDay = {
                id: day.id,
                date: day.date,
                dayOfWeek: day.dayOfWeek,
                isWorkingDay: day.isWorkingDay,
                isHoliday: day.isHoliday,
                isClosed: day.isClosed,
                countsTowardQuota: day.countsTowardQuota,
                leaveTypeColor: day.leaveTypeColor,
                workingHours: day.workingHours,
            } as LeaveDay;
            const existing = grouped.get(key);
            if (existing) {
                existing.push(compactDay);
            } else {
                grouped.set(key, [compactDay]);
            }
        });

        return records.map(record => ({
            ...record,
            leaveDays: grouped.get(record.id as string) ?? [],
        }));
    }

    async create(data: LeaveRecord) {
        const id = data.id || uuidv4();
        return this.postgres.withTransaction(async (client) => {
            try {
                const recordInput = { ...data, id };
                const leaveDays = await this.buildLeaveDays(recordInput, client);
                const computedAmount = recordInput.unit === 'Day'
                    ? this.roundToTwoDecimals(
                        leaveDays.reduce((sum, day) => sum + day.amount, 0),
                    )
                    : (recordInput.amount ?? null);

                await client.query(
                    `INSERT INTO leave_records (
                        id,
                        company_id,
                        employee_id,
                        leave_type_id,
                        start_date,
                        end_date,
                        unit,
                        amount,
                        start_time,
                        end_time,
                        note,
                        documents
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                    [
                        id,
                        recordInput.companyId,
                        recordInput.employeeId,
                        recordInput.leaveTypeId ?? null,
                        recordInput.startDate,
                        recordInput.endDate,
                        recordInput.unit,
                        computedAmount,
                        recordInput.startTime ?? null,
                        recordInput.endTime ?? null,
                        recordInput.note ?? null,
                        recordInput.documents ?? null,
                    ],
                );
                await this.writeLeaveDays(leaveDays, client);
                // Return enriched record
                const result = await client.query<LeaveRecord>(
                    `SELECT ${this.selectFields}
                     FROM leave_records lr
                     LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
                     LEFT JOIN employees e ON e.id = lr.employee_id
                     WHERE lr.id = $1 LIMIT 1`,
                    [id],
                );
                return result.rows[0];
            } catch (error) {
                this.throwIfForeignKeyError(error);
                throw new InternalServerErrorException({
                    message: 'Leave create failed',
                    error: this.formatErrorDetails(error),
                });
            }
        });
    }

    async findAll(companyId: string, limit = 50, employeeId?: string, startDate?: string, endDate?: string) {
        const queryParts = [`lr.company_id = $1`];
        const queryValues: any[] = [companyId];

        if (employeeId) {
            queryValues.push(employeeId);
            queryParts.push(`lr.employee_id = $${queryValues.length}`);
        }

        if (startDate) {
            queryValues.push(startDate);
            queryParts.push(`lr.start_date >= $${queryValues.length}`);
        }

        if (endDate) {
            queryValues.push(endDate);
            queryParts.push(`lr.start_date <= $${queryValues.length}`);
        }

        const result = await this.postgres.query<LeaveRecord>(
            `SELECT ${this.selectFields}
             FROM leave_records lr
             LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
             LEFT JOIN employees e ON e.id = lr.employee_id
             WHERE ${queryParts.join(' AND ')}
             ORDER BY lr.start_date DESC
             LIMIT $${queryValues.length + 1}`,
            [...queryValues, limit],
        );
        return this.attachLeaveDays(result.rows);
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<LeaveRecord>(
            `SELECT ${this.selectFields}
             FROM leave_records lr
             LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
             LEFT JOIN employees e ON e.id = lr.employee_id
             WHERE lr.id = $1 AND lr.company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        const record = result.rows[0];
        if (!record) return null;
        const [withDays] = await this.attachLeaveDays([record]);
        return withDays;
    }

    async update(id: string, data: Partial<LeaveRecord>, companyId: string) {
        const shouldRebuild = ['startDate', 'endDate', 'unit', 'amount', 'employeeId', 'leaveTypeId']
            .some(field => Object.prototype.hasOwnProperty.call(data, field));

        return this.postgres.withTransaction(async (client) => {
            const updates: string[] = [];
            const values: unknown[] = [];
            let index = 1;

            if (Object.prototype.hasOwnProperty.call(data, 'employeeId')) {
                updates.push(`employee_id = $${index++}`);
                values.push(data.employeeId ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'leaveTypeId')) {
                updates.push(`leave_type_id = $${index++}`);
                values.push(data.leaveTypeId ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'startDate')) {
                updates.push(`start_date = $${index++}`);
                values.push(data.startDate ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'endDate')) {
                updates.push(`end_date = $${index++}`);
                values.push(data.endDate ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'unit')) {
                updates.push(`unit = $${index++}`);
                values.push(data.unit ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'amount')) {
                updates.push(`amount = $${index++}`);
                values.push(data.amount ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'startTime')) {
                updates.push(`start_time = $${index++}`);
                values.push(data.startTime ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'endTime')) {
                updates.push(`end_time = $${index++}`);
                values.push(data.endTime ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'note')) {
                updates.push(`note = $${index++}`);
                values.push(data.note ?? null);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'documents')) {
                updates.push(`documents = $${index++}`);
                values.push(data.documents ?? null);
            }

            updates.push('updated_at = now()');
            values.push(id, companyId);

            try {
                await client.query(
                    `UPDATE leave_records
                     SET ${updates.join(', ')}
                     WHERE id = $${index++} AND company_id = $${index}`,
                    values,
                );

                let updated = await this.findOne(id, companyId);
                if (!updated) return null;

                if (shouldRebuild) {
                    await this.deleteLeaveDays(id, companyId, client);
                    const leaveDays = await this.buildLeaveDays(updated, client);
                    await this.writeLeaveDays(leaveDays, client);

                    if (updated.unit === 'Day') {
                        const computedAmount = this.roundToTwoDecimals(
                            leaveDays.reduce((sum, day) => sum + day.amount, 0),
                        );
                        if (computedAmount !== updated.amount) {
                            await client.query(
                                `UPDATE leave_records
                                 SET amount = $1, updated_at = now()
                                 WHERE id = $2 AND company_id = $3`,
                                [computedAmount, id, companyId],
                            );
                            updated = await this.findOne(id, companyId) ?? updated;
                        }
                    }
                }

                return updated;
            } catch (error) {
                this.throwIfForeignKeyError(error);
                throw new InternalServerErrorException({
                    message: 'Leave update failed',
                    error: this.formatErrorDetails(error),
                });
            }
        });
    }

    async delete(id: string, companyId: string) {
        await this.postgres.withTransaction(async (client) => {
            await this.deleteLeaveDays(id, companyId, client);
            await client.query(
                `DELETE FROM leave_records WHERE id = $1 AND company_id = $2`,
                [id, companyId],
            );
        });
    }

    async getQuotaSummary(companyId: string, employeeId: string, year: number) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // 1. Get employee employment type
        const employeeResult = await this.postgres.query<{ employmentType: string }>(
            `SELECT employment_type AS "employmentType" FROM employees WHERE id = $1 AND company_id = $2`,
            [employeeId, companyId],
        );
        const empType = employeeResult.rows[0]?.employmentType;

        // 2. Get relevant leave types (matches employment type or applies to all)
        const leaveTypesResult = await this.postgres.query<LeaveType>(
            `SELECT id, name, code, unit, quota, color
             FROM leave_types
             WHERE company_id = $1 
             AND (employment_type IS NULL OR employment_type = $2 OR $2 IS NULL)`,
            [companyId, empType],
        );

        // 3. Get usage from leave_days for this employee and year
        const usageResult = await this.postgres.query<{ leaveTypeId: string; used: number }>(
            `SELECT leave_type_id AS "leaveTypeId", SUM(amount) AS "used"
             FROM leave_days
             WHERE company_id = $1 AND employee_id = $2 AND date >= $3 AND date <= $4
             GROUP BY leave_type_id`,
            [companyId, employeeId, startDate, endDate],
        );

        const usageMap = new Map(usageResult.rows.map(r => [r.leaveTypeId, Number(r.used)]));

        // 3. Combine into summary
        return leaveTypesResult.rows.map(type => {
            const used = usageMap.get(type.id!) || 0;
            return {
                ...type,
                used,
                remaining: type.quota - used,
            };
        });
    }
}

@Controller('leaves')
@UseGuards(AuthGuard, CompanyGuard)
export class LeaveRecordsController {
    constructor(
        private service: LeaveRecordsService,
        private employeesService: EmployeesService,
        private emailService: EmailService,
        private config: ConfigService,
    ) { }

    @Post()
    async create(@Body() data: LeaveRecord, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = LeaveRecordSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        const result = await this.service.create(v.data as LeaveRecord);

        // 4. Send notification to manager
        this.sendManagerNotification(result);

        return result;
    }

    private formatDate(dateInput: string | Date): string {
        try {
            const dateStr = dateInput instanceof Date ? dateInput.toISOString().slice(0, 10) : String(dateInput);
            const date = new Date(`${dateStr}T12:00:00Z`);
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }).format(date);
        } catch (e) {
            return String(dateInput);
        }
    }

    private async sendManagerNotification(leave: LeaveRecord) {
        try {
            const employee = await this.employeesService.findOne(leave.employeeId, leave.companyId);
            if (!employee || !employee.reportingManagerEmail) {
                return;
            }

            const leaveLink = `https://app.hummane.com/member/attendance`;

            const isHourly = leave.unit === 'Hour';

            await this.emailService.sendEmail(
                [{ email: employee.reportingManagerEmail, name: employee.reportingManagerName }],
                `New ${leave.leaveTypeName || 'Leave'} Request by ${employee.name}`,
                `
                    <p>Hello ${employee.reportingManagerName},</p>
                    <p><strong>${employee.name}</strong> has submitted a new <strong>${leave.leaveTypeName || 'Leave'}</strong> request:</p>
                    <ul>
                        ${isHourly ? `
                            <li><strong>Date:</strong> ${this.formatDate(leave.startDate)}</li>
                            <li><strong>Start Time:</strong> ${leave.startTime}</li>
                            <li><strong>End Time:</strong> ${leave.endTime}</li>
                        ` : `
                            <li><strong>Start Date:</strong> ${this.formatDate(leave.startDate)}</li>
                            <li><strong>End Date:</strong> ${this.formatDate(leave.endDate)}</li>
                        `}
                        ${leave.note ? `<li><strong>Note:</strong> ${leave.note}</li>` : ''}
                    </ul>

                    <p>You can review and manage leave requests at the link below:</p>
                    <p><a href="${leaveLink}">${leaveLink}</a></p>
                    <p>Best regards,<br/>Hummane HR</p>
                `,
            );
        } catch (error) {
            console.error('Failed to send leave notification email:', error);
        }
    }

    @Get()
    async findAll(
        @Req() req,
        @Query('limit') limit?: string,
        @Query('employeeId') employeeId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const companyId = req.user.companyId;
        // Default to Jan 1st of current year if no startDate is provided
        const year = new Date().getFullYear();
        const effectiveStartDate = startDate || `${year}-01-01`;

        const records = await this.service.findAll(
            companyId,
            parseLimit(limit, 200, 500),
            employeeId,
            effectiveStartDate,
            endDate,
        );

        let summary = null;
        if (employeeId) {
            summary = await this.service.getQuotaSummary(companyId, employeeId, year);
        }

        return {
            records,
            summary,
        };
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<LeaveRecord>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<LeaveRecord>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    imports: [EmployeesModule, EmailModule, ConfigModule],
    controllers: [LeaveRecordsController],
    providers: [LeaveRecordsService],
    exports: [LeaveRecordsService]
})
export class LeaveRecordsModule { }
