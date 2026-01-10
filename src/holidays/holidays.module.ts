import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Holiday, HolidaySchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HolidaysService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Holiday) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('holidays').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('holidays')
            .where('companyId', '==', companyId)
            .get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection('holidays').doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as Holiday;
        if (data.companyId !== companyId) return null;
        return data;
    }

    async update(id: string, data: Partial<Holiday>, companyId: string) {
        const ref = this.firestore.getCollection('holidays').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as Holiday;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: new Date().toISOString() }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('holidays').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as Holiday;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('holidays')
@UseGuards(AuthGuard)
export class HolidaysController {
    constructor(private service: HolidaysService) { }

    @Post()
    create(@Body() data: Holiday, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        data.companyId = user.companyId;

        const v = HolidaySchema.safeParse(data);
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
    update(@Param('id') id: string, @Body() data: Partial<Holiday>, @Req() req) {
        return this.service.update(id, data, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [HolidaysController],
    providers: [HolidaysService],
    exports: [HolidaysService]
})
export class HolidaysModule { }
