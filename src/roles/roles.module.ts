import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { Role, RoleSchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RolesService {
    constructor(private firestore: FirestoreService) { }

    async create(data: Role) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('roles').doc(id).set(doc);
        return doc;
    }

    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('roles');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }

    async findOne(id: string) {
        const doc = await this.firestore.getCollection('roles').doc(id).get();
        return doc.exists ? doc.data() : null;
    }

    async update(id: string, data: Partial<Role>) {
        const ref = this.firestore.getCollection('roles').doc(id);
        await ref.set({ ...data }, { merge: true });
        return (await ref.get()).data();
    }

    async delete(id: string) {
        await this.firestore.getCollection('roles').doc(id).delete();
    }
}

@Controller('roles')
@UseGuards(AuthGuard)
export class RolesController {
    constructor(private service: RolesService) { }

    @Post()
    create(@Body() data: Role) {
        const v = RoleSchema.safeParse(data);
        if (!v.success) throw new Error('Invalid data');
        return this.service.create(data);
    }

    @Get()
    findAll(@Query('companyId') cid: string) { return this.service.findAll(cid); }

    @Get(':id')
    findOne(@Param('id') id: string) { return this.service.findOne(id); }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Role>) { return this.service.update(id, data); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService]
})
export class RolesModule { }
