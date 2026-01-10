import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Job, JobSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Job) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('jobs').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('jobs')
            .where('companyId', '==', companyId)
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

        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
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
@UseGuards(AuthGuard)
export class JobsController {
    constructor(private service: JobsService) { }

    @Post()
    create(@Body() data: Job, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        data.companyId = user.companyId;

        const v = JobSchema.safeParse(data);
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
    update(@Param('id') id: string, @Body() data: Partial<Job>, @Req() req) {
        return this.service.update(id, data, req.user.companyId);
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
