import { Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
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
        const doc = { ...data, id, createdAt: Timestamp.now() };
        await this.firestore.getCollection('feedbackCards').doc(id).set(doc);
        return doc;
    }
    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('feedbackCards')
            .where('companyId', '==', companyId)
            .get();
        return snap.docs.map(d => d.data());
    }
    async findOne(id: string, companyId: string) {
        const d = await this.firestore.getCollection('feedbackCards').doc(id).get();
        if (!d.exists) return null;
        const data = d.data() as FeedbackCard;
        if (data.companyId !== companyId) return null;
        return data;
    }
    async update(id: string, data: Partial<FeedbackCard>, companyId: string) {
        const ref = this.firestore.getCollection('feedbackCards').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as FeedbackCard;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        return this.findOne(id, companyId);
    }
    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('feedbackCards').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as FeedbackCard;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Injectable()
export class FeedbackEntriesService {
    constructor(private firestore: FirestoreService) { }
    async create(data: FeedbackEntry) {
        const id = data.id || uuidv4();
        const doc = { ...data, id, createdAt: Timestamp.now() };
        await this.firestore.getCollection('feedbackEntries').doc(id).set(doc);
        return doc;
    }
    async findAll(companyId: string) {
        const snap = await this.firestore.getCollection('feedbackEntries')
            .where('companyId', '==', companyId)
            .get();
        return snap.docs.map(d => d.data());
    }
    async findOne(id: string, companyId: string) {
        const d = await this.firestore.getCollection('feedbackEntries').doc(id).get();
        if (!d.exists) return null;
        const data = d.data() as FeedbackEntry;
        if (data.companyId !== companyId) return null;
        return data;
    }
    async update(id: string, data: Partial<FeedbackEntry>, companyId: string) {
        const ref = this.firestore.getCollection('feedbackEntries').doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const currentData = doc.data() as FeedbackEntry;
        if (currentData.companyId !== companyId) return null;

        await ref.set({ ...data, updatedAt: Timestamp.now() }, { merge: true });
        return this.findOne(id, companyId);
    }
    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection('feedbackEntries').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as FeedbackEntry;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

// Controllers
@Controller('feedback-cards')
@UseGuards(AuthGuard)
export class FeedbackCardsController {
    constructor(private service: FeedbackCardsService) { }
    @Post() create(@Body() d: FeedbackCard, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        // 1. Force companyId from token
        d.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = FeedbackCardSchema.safeParse(d);
        if (!v.success) {
            throw new Error('Invalid: ' + JSON.stringify(v.error.issues));
        }

        // 3. Persist validated data
        return this.service.create(v.data as FeedbackCard);
    }
    @Get() findAll(@Req() req) { return this.service.findAll(req.user.companyId); }
    @Get(':id') findOne(@Param('id') id: string, @Req() req) { return this.service.findOne(id, req.user.companyId); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackCard>, @Req() req) { return this.service.update(id, d, req.user.companyId); }
    @Delete(':id') remove(@Param('id') id: string, @Req() req) { return this.service.delete(id, req.user.companyId); }
}

@Controller('feedback-entries')
@UseGuards(AuthGuard)
export class FeedbackEntriesController {
    constructor(private service: FeedbackEntriesService) { }
    @Post() create(@Body() d: FeedbackEntry, @Req() req) {
        const user = req.user;
        if (!user.companyId) throw new Error('User does not belong to a company');

        // 1. Force companyId from token
        d.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = FeedbackEntrySchema.safeParse(d);
        if (!v.success) {
            throw new Error('Invalid: ' + JSON.stringify(v.error.issues));
        }

        // 3. Persist validated data
        return this.service.create(v.data as FeedbackEntry);
    }
    @Get() findAll(@Req() req) { return this.service.findAll(req.user.companyId); }
    @Get(':id') findOne(@Param('id') id: string, @Req() req) { return this.service.findOne(id, req.user.companyId); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackEntry>, @Req() req) { return this.service.update(id, d, req.user.companyId); }
    @Delete(':id') remove(@Param('id') id: string, @Req() req) { return this.service.delete(id, req.user.companyId); }
}

@Module({
    controllers: [FeedbackCardsController, FeedbackEntriesController],
    providers: [FeedbackCardsService, FeedbackEntriesService],
    exports: [FeedbackCardsService, FeedbackEntriesService]
})
export class FeedbackModule { }
