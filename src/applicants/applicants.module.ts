import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Applicant, ApplicantSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class ApplicantsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Applicant) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const doc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };
        await this.firestore.getCollection('applicants').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string, limit = 50) {
        const snap = await this.firestore.getCollection('applicants')
            .where('companyId', '==', companyId)
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('applicants').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as Applicant;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<Applicant>, companyId: string) {
        const ref = this.firestore.getCollection('applicants').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as Applicant;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('applicants').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as Applicant;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('applicants')
@UseGuards(AuthGuard, CompanyGuard)
export class ApplicantsController {
    constructor(private service: ApplicantsService) { }

    @Post()
    create(@Body() data: Applicant, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = ApplicantSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as Applicant);
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
    update(@Param('id') id: string, @Body() data: Partial<Applicant>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Applicant>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [ApplicantsController],
    providers: [ApplicantsService],
    exports: [ApplicantsService]
})
export class ApplicantsModule { }
