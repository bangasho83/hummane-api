import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { LeaveRecord, LeaveRecordSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LeaveRecordsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: LeaveRecord) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('leaves').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('leaves')
            .where('companyId', '==', companyId)
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

        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        return (await ref.get()).data();
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
@UseGuards(AuthGuard)
export class LeaveRecordsController {
    constructor(private service: LeaveRecordsService) { }

    @Post()
    create(@Body() data: LeaveRecord, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        data.companyId = user.companyId;

        const v = LeaveRecordSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data: ' + JSON.stringify(v.error.issues));
        return this.service.create(data);
    }

    @Get()
    findAll(@Req() req) {
        return this.service.findAll(req.user.companyId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<LeaveRecord>, @Req() req) {
        return this.service.update(id, data, req.user.companyId);
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
