import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Department, DepartmentSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DepartmentsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Department) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('departments').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('departments');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string) {
        const doc = await this.firestore.getCollection('departments').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async update(id: string, data: Partial<Department>) {
        const ref = this.firestore.getCollection('departments').doc(id);
        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        const updated = await ref.get();
        return updated.data();
    }

    async delete(id: string) {
        await this.firestore.getCollection('departments').doc(id).delete();
    }
}

@Controller('departments')
@UseGuards(AuthGuard)
export class DepartmentsController {
    constructor(private service: DepartmentsService) { }

    @Post()
    create(@Body() data: Department) {
        const v = DepartmentSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data');
        return this.service.create(data);
    }

    @Get()
    findAll(@Query('companyId') cid: string) { return this.service.findAll(cid); }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.service.findOne(id); }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Department>) { return this.service.update(id, data); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService]
})
export class DepartmentsModule { }
