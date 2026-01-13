import { BadRequestException, InternalServerErrorException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { LeaveDay, LeaveRecord, LeaveRecordSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';
import { PoolClient } from 'pg';

@Injectable()
export class LeaveRecordsService {
    constructor(private postgres: PostgresService) { }

    private leaveDaySelectFields = [
        'id',
        'leave_record_id AS "leaveRecordId"',
        'company_id AS "companyId"',
        'employee_id AS "employeeId"',
        'leave_type_id AS "leaveTypeId"',
        'date',
        'day_of_week AS "dayOfWeek"',
        'unit',
        'amount',
        'is_working_day AS "isWorkingDay"',
        'is_holiday AS "isHoliday"',
        'is_closed AS "isClosed"',
        'counts_toward_quota AS "countsTowardQuota"',
        'working_hours AS "workingHours"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
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
        'id',
        'company_id AS "companyId"',
        'employee_id AS "employeeId"',
        'leave_type_id AS "leaveTypeId"',
        'start_date AS "startDate"',
        'end_date AS "endDate"',
        'unit',
        'amount',
        'note',
        'documents',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
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

        const workingDayCount = baseDays.filter(day => day.isWorkingDay).length;
        const totalAmount = record.amount;

        return baseDays.map(day => {
            let amount = 0;
            if (record.unit === 'Hour') {
                amount = day.isWorkingDay ? (totalAmount ?? 0) : 0;
            } else if (day.isWorkingDay) {
                if (totalAmount !== undefined) {
                    amount = workingDayCount ? this.roundToTwoDecimals(totalAmount / workingDayCount) : 0;
                } else {
                    amount = 1;
                }
            }

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
             FROM leave_days
             WHERE company_id = $1 AND leave_record_id = ANY($2)
             ORDER BY date ASC`,
            [records[0].companyId, recordIds],
        );

        const grouped = new Map<string, LeaveDay[]>();
        result.rows.forEach(day => {
            const key = day.leaveRecordId as string;
            const existing = grouped.get(key);
            if (existing) {
                existing.push(day);
            } else {
                grouped.set(key, [day]);
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
                const result = await client.query<LeaveRecord>(
                    `INSERT INTO leave_records (
                        id,
                        company_id,
                        employee_id,
                        leave_type_id,
                        start_date,
                        end_date,
                        unit,
                        amount,
                        note,
                        documents
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    RETURNING ${this.selectFields}`,
                    [
                        id,
                        data.companyId,
                        data.employeeId,
                        data.leaveTypeId ?? null,
                        data.startDate,
                        data.endDate,
                        data.unit,
                        data.amount ?? null,
                        data.note ?? null,
                        data.documents ?? null,
                    ],
                );
                const record = result.rows[0];
                const leaveDays = await this.buildLeaveDays(record, client);
                await this.writeLeaveDays(leaveDays, client);
                return record;
            } catch (error) {
                this.throwIfForeignKeyError(error);
                throw new InternalServerErrorException({
                    message: 'Leave create failed',
                    error: this.formatErrorDetails(error),
                });
            }
        });
    }

    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<LeaveRecord>(
            `SELECT ${this.selectFields}
             FROM leave_records
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return this.attachLeaveDays(result.rows);
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<LeaveRecord>(
            `SELECT ${this.selectFields}
             FROM leave_records
             WHERE id = $1 AND company_id = $2
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
                const result = await client.query<LeaveRecord>(
                    `UPDATE leave_records
                     SET ${updates.join(', ')}
                     WHERE id = $${index++} AND company_id = $${index}
                     RETURNING ${this.selectFields}`,
                    values,
                );

                const updated = result.rows[0];
                if (!updated) return null;

                if (shouldRebuild) {
                    await this.deleteLeaveDays(id, companyId, client);
                    const leaveDays = await this.buildLeaveDays(updated, client);
                    await this.writeLeaveDays(leaveDays, client);
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
}

@Controller('leaves')
@UseGuards(AuthGuard, CompanyGuard)
export class LeaveRecordsController {
    constructor(private service: LeaveRecordsService) { }

    @Post()
    create(@Body() data: LeaveRecord, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = LeaveRecordSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as LeaveRecord);
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
    controllers: [LeaveRecordsController],
    providers: [LeaveRecordsService],
    exports: [LeaveRecordsService]
})
export class LeaveRecordsModule { }
