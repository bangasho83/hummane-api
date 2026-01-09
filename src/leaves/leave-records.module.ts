import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
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
        await this.firestore.getCollection('leaves').doc(id).set(doc); // Note: Current storage uses 'leaves' for records
        return doc;
    }

    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('leaves');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string) {
        const doc = await this.firestore.getCollection('leaves').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async update(id: string, data: Partial<LeaveRecord>) {
        const ref = this.firestore.getCollection('leaves').doc(id);
        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true }); // updatedAt not in schema but safe
        return (await ref.get()).data();
    }

    async delete(id: string) {
        await this.firestore.getCollection('leaves').doc(id).delete();
    }
}

@Controller('leaves')
@UseGuards(AuthGuard)
export class LeaveRecordsController {
    constructor(private service: LeaveRecordsService) { }

    @Post()
    create(@Body() data: LeaveRecord) {
        const v = LeaveRecordSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data');
        return this.service.create(data);
    }

    @Get()
    findAll(@Query('companyId') cid: string) { return this.service.findAll(cid); }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.service.findOne(id); }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<LeaveRecord>) { return this.service.update(id, data); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [LeaveRecordsController],
    providers: [LeaveRecordsService],
    exports: [LeaveRecordsService]
})
export class LeaveRecordsModule { }
