import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Applicant, ApplicantSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ApplicantsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Applicant) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('applicants').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('applicants');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string) {
        const doc = await this.firestore.getCollection('applicants').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async update(id: string, data: Partial<Applicant>) {
        const ref = this.firestore.getCollection('applicants').doc(id);
        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string) {
        await this.firestore.getCollection('applicants').doc(id).delete();
    }
}

@Controller('applicants')
@UseGuards(AuthGuard)
export class ApplicantsController {
    constructor(private service: ApplicantsService) { }

    @Post()
    create(@Body() data: Applicant) {
        const v = ApplicantSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data');
        return this.service.create(data);
    }

    @Get()
    findAll(@Query('companyId') cid: string) { return this.service.findAll(cid); }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.service.findOne(id); }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Applicant>) { return this.service.update(id, data); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [ApplicantsController],
    providers: [ApplicantsService],
    exports: [ApplicantsService]
})
export class ApplicantsModule { }
