import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { LeaveDay, LeaveRecord, LeaveRecordSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class LeaveRecordsService {
    constructor(private firestore: FirestoreService) { }

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

        const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' });
        const date = new Date(`${dateString}T12:00:00Z`);
        const weekday = formatter.format(date).toLowerCase();
        return weekdayKeys.includes(weekday) ? weekday : weekdayKeys[date.getUTCDay()];
    }

    private roundToTwoDecimals(value: number) {
        return Math.round(value * 100) / 100;
    }

    private async deleteLeaveDays(leaveRecordId: string) {
        const leaveDaysCollection = this.firestore.getCollection('leaveDays');
        const snapshot = await leaveDaysCollection.where('leaveRecordId', '==', leaveRecordId).get();
        if (snapshot.empty) return;

        const firestore = leaveDaysCollection.firestore;
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
            const batch = firestore.batch();
            docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }

    private async writeLeaveDays(leaveDays: LeaveDay[]) {
        if (!leaveDays.length) return;
        const leaveDaysCollection = this.firestore.getCollection('leaveDays');
        const firestore = leaveDaysCollection.firestore;
        for (let i = 0; i < leaveDays.length; i += 400) {
            const batch = firestore.batch();
            leaveDays.slice(i, i + 400).forEach(day => {
                const docRef = leaveDaysCollection.doc(day.id || uuidv4());
                batch.set(docRef, day);
            });
            await batch.commit();
        }
    }

    private async buildLeaveDays(record: LeaveRecord): Promise<LeaveDay[]> {
        const companyDoc = await this.firestore.getCollection('companies').doc(record.companyId).get();
        const companyData = companyDoc.exists ? (companyDoc.data() as any) : {};
        const workingHours = companyData?.workingHours || null;
        const companyTimeZone = companyData?.timezone;

        const holidaysSnapshot = await this.firestore.getCollection('holidays')
            .where('companyId', '==', record.companyId)
            .where('date', '>=', record.startDate)
            .where('date', '<=', record.endDate)
            .get();
        const holidayDates = new Set(holidaysSnapshot.docs.map(doc => (doc.data() as any).date));

        const dates = this.getDateRange(record.startDate, record.endDate);
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

            const timestamp = Timestamp.now();
            return {
                ...day,
                amount,
                createdAt: timestamp,
                updatedAt: timestamp,
            };
        });
    }

    async create(data: LeaveRecord) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const doc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };
        await this.firestore.getCollection('leaves').doc(id).set(doc);
        const leaveDays = await this.buildLeaveDays(doc);
        await this.writeLeaveDays(leaveDays);
        return doc;
    }

    async findAll(companyId: string, limit = 50) {
        const snap = await this.firestore.getCollection('leaves')
            .where('companyId', '==', companyId)
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('leaves').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as LeaveRecord;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<LeaveRecord>, companyId: string) {
        const ref = this.firestore.getCollection('leaves').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as LeaveRecord;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        const updated = (await ref.get()).data() as LeaveRecord;

        const shouldRebuild = ['startDate', 'endDate', 'unit', 'amount', 'employeeId', 'leaveTypeId']
            .some(field => field in data);
        if (shouldRebuild) {
            await this.deleteLeaveDays(id);
            const leaveDays = await this.buildLeaveDays(updated);
            await this.writeLeaveDays(leaveDays);
        }

        return updated;
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('leaves').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as LeaveRecord;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
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
