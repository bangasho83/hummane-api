import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { EmployeeDocument, EmployeeDocumentSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: EmployeeDocument) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, uploadedAt: new Date().toISOString() };
        await this.firestore.getCollection('documents').doc(id).set(doc);
        return doc;
    }

    async findAll(employeeId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('documents');
        if (employeeId) query = query.where('employeeId', '==', employeeId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string) {
        const doc = await this.firestore.getCollection('documents').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async delete(id: string) {
        await this.firestore.getCollection('documents').doc(id).delete();
    }
}

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
    constructor(private service: DocumentsService) { }

    @Post()
    create(@Body() data: EmployeeDocument) {
        const v = EmployeeDocumentSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data');
        return this.service.create(data);
    }

    @Get()
    findAll(@Query('employeeId') eid: string) { return this.service.findAll(eid); }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.service.findOne(id); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [DocumentsController],
    providers: [DocumentsService],
    exports: [DocumentsService]
})
export class DocumentsModule { }
