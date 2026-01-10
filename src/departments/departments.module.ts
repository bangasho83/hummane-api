import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Department, DepartmentSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DepartmentsService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Department) {
        if (!data.companyId) {
            console.error(`[DepartmentsService] [CRITICAL] ATTEMPTED TO CREATE DEPARTMENT WITHOUT COMPANY_ID! Data:`, JSON.stringify(data));
            throw new Error('Internal Error: companyId is missing in service layer');
        }

        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };

        await this.firestore.getCollection('departments').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('departments')
            .where('companyId', '==', companyId)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('departments').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as Department;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<Department>, companyId: string) {
        const ref = this.firestore.getCollection('departments').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as Department;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        const updated = await ref.get();
        return updated.data();
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('departments').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as Department;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('departments')
@UseGuards(AuthGuard)
export class DepartmentsController {
    constructor(private service: DepartmentsService) { }

    @Post()
    create(@Body() data: Department, @Req() req) {
        const user = req.user;

        if (!user || !user.companyId) {
            throw new Error('User does not belong to a company or session is invalid');
        }

        // 1. Force companyId from token
        data.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = DepartmentSchema.safeParse(data);
        if (!v.success) {
            throw new Error('Invalid data: ' + JSON.stringify(v.error.issues));
        }

        // 3. Persist validated data
        return this.service.create(v.data as Department);
    }

    @Get()
    findAll(@Req() req) {
        const user = req.user;
        return this.service.findAll(user.companyId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Department>, @Req() req) {
        return this.service.update(id, data, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService]
})
export class DepartmentsModule { }
