import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query } from '@nestjs/common';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { FeedbackCard, FeedbackCardSchema, FeedbackEntry, FeedbackEntrySchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';

// Services
@Injectable()
export class FeedbackCardsService {
    constructor(private firestore: FirestoreService) { }
    async create(data: FeedbackCard) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('feedbackCards').doc(id).set(doc);
        return doc;
    }
    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('feedbackCards');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }
    async findOne(id: string) { const d = await this.firestore.getCollection('feedbackCards').doc(id).get(); return d.exists ? d.data() as FeedbackCard : null; }
    async update(id: string, data: Partial<FeedbackCard>) { await this.firestore.getCollection('feedbackCards').doc(id).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true }); return this.findOne(id); }
    async delete(id: string) { await this.firestore.getCollection('feedbackCards').doc(id).delete(); }
}

@Injectable()
export class FeedbackEntriesService {
    constructor(private firestore: FirestoreService) { }
    async create(data: FeedbackEntry) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: new Date().toISOString() };
        await this.firestore.getCollection('feedbackEntries').doc(id).set(doc);
        return doc;
    }
    async findAll(companyId?: string) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection('feedbackEntries');
        if (companyId) query = query.where('companyId', '==', companyId);
        const snap = await query.get();
        return snap.docs.map(d => d.data());
    }
    async findOne(id: string) { const d = await this.firestore.getCollection('feedbackEntries').doc(id).get(); return d.exists ? d.data() as FeedbackEntry : null; }
    async update(id: string, data: Partial<FeedbackEntry>) { await this.firestore.getCollection('feedbackEntries').doc(id).set({ ...data, updatedAt: new Date().toISOString() }, { merge: true }); return this.findOne(id); }
    async delete(id: string) { await this.firestore.getCollection('feedbackEntries').doc(id).delete(); }
}

// Controllers
@Controller('feedback-cards')
@UseGuards(AuthGuard)
export class FeedbackCardsController {
    constructor(private service: FeedbackCardsService) { }
    @Post() create(@Body() d: FeedbackCard) { const v = FeedbackCardSchema.safeParse(d); if (!v.success) throw new Error('Invalid'); return this.service.create(d); }
    @Get() findAll(@Query('companyId') c: string) { return this.service.findAll(c); }
    @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackCard>) { return this.service.update(id, d); }
    @Delete(':id') remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Controller('feedback-entries')
@UseGuards(AuthGuard)
export class FeedbackEntriesController {
    constructor(private service: FeedbackEntriesService) { }
    @Post() create(@Body() d: FeedbackEntry) { const v = FeedbackEntrySchema.safeParse(d); if (!v.success) throw new Error('Invalid'); return this.service.create(d); }
    @Get() findAll(@Query('companyId') c: string) { return this.service.findAll(c); }
    @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackEntry>) { return this.service.update(id, d); }
    @Delete(':id') remove(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
    controllers: [FeedbackCardsController, FeedbackEntriesController],
    providers: [FeedbackCardsService, FeedbackEntriesService],
    exports: [FeedbackCardsService, FeedbackEntriesService]
})
export class FeedbackModule { }
