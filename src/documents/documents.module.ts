import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { EmployeeDocument, EmployeeDocumentSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class DocumentsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: EmployeeDocument) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const doc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };
        await this.firestore.getCollection('documents').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string, employeeId?: string, limit = 50) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('documents')
            .where('companyId', '==', companyId);
        if (employeeId) query = query.where('employeeId', '==', employeeId);
        const snap = await query.limit(limit).get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('documents').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as EmployeeDocument;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('documents').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as EmployeeDocument;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('documents')
@UseGuards(AuthGuard, CompanyGuard)
export class DocumentsController {
    constructor(private service: DocumentsService) { }

    @Post()
    create(@Body() data: EmployeeDocument, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = EmployeeDocumentSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as EmployeeDocument);
    }

    @Get()
    findAll(@Query('employeeId') eid: string, @Query('limit') limit: string, @Req() req) {
        return this.service.findAll(req.user.companyId, eid, parseLimit(limit));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [DocumentsController],
    providers: [DocumentsService],
    exports: [DocumentsService]
})
export class DocumentsModule { }
