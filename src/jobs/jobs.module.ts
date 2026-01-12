import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { Job, JobSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';

@Injectable()
export class JobsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Job) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const doc = { ...data, id, createdAt: timestamp, updatedAt: timestamp };
        await this.firestore.getCollection('jobs').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string, limit = 50) {
        const snap = await this.firestore.getCollection('jobs')
            .where('companyId', '==', companyId)
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('jobs').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as Job;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<Job>, companyId: string) {
        const ref = this.firestore.getCollection('jobs').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as Job;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('jobs').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as Job;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('jobs')
@UseGuards(AuthGuard, CompanyGuard)
export class JobsController {
    constructor(private service: JobsService) { }

    @Post()
    create(@Body() data: Job, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = JobSchema.safeParse(data);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as Job);
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
    update(@Param('id') id: string, @Body() data: Partial<Job>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<Job>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [JobsController],
    providers: [JobsService],
    exports: [JobsService]
})
export class JobsModule { }
