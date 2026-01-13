import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { UserInvitation, UserInvitationSchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class InvitationsService {
    private collectionName = 'user_invitations';

    constructor(private firestore: FirestoreService) { }

    private sanitize(invitation: UserInvitation) {
        const { tokenHash, ...rest } = invitation as UserInvitation & { tokenHash?: string };
        return rest;
    }

    async create(data: UserInvitation, rawToken: string | null) {
        const id = data.id || uuidv4();
        const timestamp = Timestamp.now();
        const tokenHash = rawToken ? createHash('sha256').update(rawToken).digest('hex') : undefined;
        const doc = { ...data, id, tokenHash, createdAt: timestamp, updatedAt: timestamp };

        await this.firestore.getCollection(this.collectionName).doc(id).set(doc);
        return this.sanitize(doc);
    }

    async findAll(companyId: string, status?: string, email?: string, limit = 50) {
        let query: FirebaseFirestore.Query = this.firestore.getCollection(this.collectionName)
            .where('companyId', '==', companyId);
        if (status) query = query.where('status', '==', status);
        if (email) query = query.where('email', '==', email);
        const snap = await query.limit(limit).get();
        return snap.docs.map(d => this.sanitize(d.data() as UserInvitation));
    }

    async findOne(id: string, companyId: string) {
        const doc = await this.firestore.getCollection(this.collectionName).doc(id).get();
        if (!doc.exists) return null;
        const data = doc.data() as UserInvitation;
        if (data.companyId !== companyId) return null;
        return this.sanitize(data);
    }

    async update(id: string, data: Partial<UserInvitation>, companyId: string) {
        const ref = this.firestore.getCollection(this.collectionName).doc(id);
        const doc = await ref.get();
        if (!doc.exists) return null;
        const current = doc.data() as UserInvitation;
        if (current.companyId !== companyId) return null;

        const updated = { ...current, ...data, updatedAt: Timestamp.now() };
        await ref.set(updated, { merge: true });
        return this.sanitize(updated as UserInvitation);
    }

    async delete(id: string, companyId: string) {
        const ref = this.firestore.getCollection(this.collectionName).doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const data = doc.data() as UserInvitation;
            if (data.companyId === companyId) {
                await ref.delete();
            }
        }
    }
}

@Controller('invitations')
@UseGuards(AuthGuard, CompanyGuard)
export class InvitationsController {
    constructor(private service: InvitationsService) { }

    @Post()
    async create(@Body() data: UserInvitation, @Req() req) {
        const user = req.user;
        const payload = { ...data };
        payload.companyId = user.companyId;
        payload.invitedBy = user.id;
        if (!payload.status) payload.status = 'pending';

        if (typeof (payload as { expiresAt?: unknown }).expiresAt === 'string') {
            const date = new Date((payload as { expiresAt: string }).expiresAt);
            if (Number.isNaN(date.getTime())) {
                throw new BadRequestException('expiresAt must be a valid ISO date string');
            }
            (payload as { expiresAt: Timestamp }).expiresAt = Timestamp.fromDate(date);
        }

        const result = UserInvitationSchema.safeParse(payload);
        if (!result.success) {
            throw new BadRequestException(result.error.issues);
        }

        const inviteToken = randomBytes(32).toString('hex');
        const created = await this.service.create(result.data as UserInvitation, inviteToken);
        return { ...created, inviteToken };
    }

    @Get()
    findAll(@Req() req, @Query('status') status?: string, @Query('email') email?: string, @Query('limit') limit?: string) {
        return this.service.findAll(req.user.companyId, status, email, parseLimit(limit));
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req) {
        return this.service.findOne(id, req.user.companyId);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<UserInvitation>, @Req() req) {
        const updateData = { ...data };
        delete (updateData as Partial<UserInvitation>).companyId;
        delete (updateData as Partial<UserInvitation>).invitedBy;
        delete (updateData as Partial<UserInvitation> & { tokenHash?: string }).tokenHash;

        if (typeof (updateData as { expiresAt?: unknown }).expiresAt === 'string') {
            const date = new Date((updateData as { expiresAt: string }).expiresAt);
            if (Number.isNaN(date.getTime())) {
                throw new BadRequestException('expiresAt must be a valid ISO date string');
            }
            (updateData as { expiresAt: Timestamp }).expiresAt = Timestamp.fromDate(date);
        }
        if (typeof (updateData as { acceptedAt?: unknown }).acceptedAt === 'string') {
            const date = new Date((updateData as { acceptedAt: string }).acceptedAt);
            if (Number.isNaN(date.getTime())) {
                throw new BadRequestException('acceptedAt must be a valid ISO date string');
            }
            (updateData as { acceptedAt: Timestamp }).acceptedAt = Timestamp.fromDate(date);
        }

        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService]
})
export class InvitationsModule { }
