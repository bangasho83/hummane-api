import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { LeaveType, LeaveTypeSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class LeaveTypesService {
    constructor(private firestore: FirestoreService) { }

    async create(data: LeaveType) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const doc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };
        await this.firestore.getCollection('leaveTypes').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string, limit = 50) {
        const snap = await this.firestore.getCollection('leaveTypes')
            .where('companyId', '==', companyId)
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('leaveTypes').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as LeaveType;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<LeaveType>, companyId: string) {
        const ref = this.firestore.getCollection('leaveTypes').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as LeaveType;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('leaveTypes').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as LeaveType;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('leave-types')
@UseGuards(AuthGuard, CompanyGuard)
export class LeaveTypesController {
    constructor(private service: LeaveTypesService) { }

    @Post()
    create(@Body() data: LeaveType, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = LeaveTypeSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as LeaveType);
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
    update(@Param('id') id: string, @Body() data: Partial<LeaveType>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<LeaveType>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [LeaveTypesController],
    providers: [LeaveTypesService],
    exports: [LeaveTypesService]
})
export class LeaveTypesModule { }
