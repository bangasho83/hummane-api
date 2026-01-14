import { BadRequestException, InternalServerErrorException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { FeedbackCard, FeedbackCardSchema, FeedbackEntry, FeedbackEntrySchema } from '../schemas/hr.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { PostgresService } from '../postgres/postgres.service';

// Services
@Injectable()
export class FeedbackCardsService {
    constructor(private postgres: PostgresService) { }

    private formatErrorDetails(error: unknown) {
        const pgError = error as { name?: string; code?: string; message?: string; detail?: string; constraint?: string };
        return {
            name: pgError?.name,
            code: pgError?.code,
            message: pgError?.message,
            detail: pgError?.detail,
            constraint: pgError?.constraint,
        };
    }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'title',
        'subject',
        'questions',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: FeedbackCard) {
        const id = data.id || uuidv4();
        try {
            const result = await this.postgres.query<FeedbackCard>(
                `INSERT INTO feedback_cards (id, company_id, title, subject, questions)
                 VALUES ($1, $2, $3, $4, $5::jsonb)
                 RETURNING ${this.selectFields}`,
                [
                    id,
                    data.companyId,
                    data.title,
                    data.subject,
                    JSON.stringify(data.questions ?? []),
                ],
            );
            return result.rows[0];
        } catch (error) {
            throw new InternalServerErrorException({
                message: 'Feedback card create failed',
                error: this.formatErrorDetails(error),
            });
        }
    }
    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<FeedbackCard>(
            `SELECT ${this.selectFields}
             FROM feedback_cards
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }
    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<FeedbackCard>(
            `SELECT ${this.selectFields}
             FROM feedback_cards
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }
    async update(id: string, data: Partial<FeedbackCard>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (data.title !== undefined) {
            updates.push(`title = $${index++}`);
            values.push(data.title);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'subject')) {
            updates.push(`subject = $${index++}`);
            values.push(data.subject ?? null);
        }
            if (Object.prototype.hasOwnProperty.call(data, 'questions')) {
                updates.push(`questions = $${index++}::jsonb`);
                values.push(JSON.stringify(data.questions ?? []));
            }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        try {
            const result = await this.postgres.query<FeedbackCard>(
                `UPDATE feedback_cards
                 SET ${updates.join(', ')}
                 WHERE id = $${index++} AND company_id = $${index}
                 RETURNING ${this.selectFields}`,
                values,
            );
            return result.rows[0] ?? null;
        } catch (error) {
            throw new InternalServerErrorException({
                message: 'Feedback card update failed',
                error: this.formatErrorDetails(error),
            });
        }
    }
    async delete(id: string, companyId: string) {
        try {
            await this.postgres.query(
                `DELETE FROM feedback_cards WHERE id = $1 AND company_id = $2`,
                [id, companyId],
            );
        } catch (error) {
            const pgError = error as { code?: string; constraint?: string };
            if (pgError?.code === '23503' && pgError.constraint === 'feedback_entries_card_fk') {
                throw new BadRequestException({
                    message: 'Cannot delete feedback card with existing entries',
                    action: 'This card has feedback entries. Delete those entries first, then try again.',
                    error: {
                        code: pgError.code,
                        constraint: pgError.constraint,
                    },
                });
            }
            throw new InternalServerErrorException({
                message: 'Feedback card delete failed',
                error: this.formatErrorDetails(error),
            });
        }
    }
}

@Injectable()
export class FeedbackEntriesService {
    constructor(private postgres: PostgresService) { }

    private formatErrorDetails(error: unknown) {
        const pgError = error as { name?: string; code?: string; message?: string; detail?: string; constraint?: string };
        return {
            name: pgError?.name,
            code: pgError?.code,
            message: pgError?.message,
            detail: pgError?.detail,
            constraint: pgError?.constraint,
        };
    }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'card_id AS "cardId"',
        'type',
        'subject_type AS "subjectType"',
        'subject_id AS "subjectId"',
        'subject_name AS "subjectName"',
        'author_id AS "authorId"',
        'author_name AS "authorName"',
        'answers',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    async create(data: FeedbackEntry) {
        const id = data.id || uuidv4();
        try {
            const result = await this.postgres.query<FeedbackEntry>(
                `INSERT INTO feedback_entries (
                    id,
                    company_id,
                    card_id,
                    type,
                    subject_type,
                    subject_id,
                    subject_name,
                    author_id,
                    author_name,
                    answers
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
                RETURNING ${this.selectFields}`,
                [
                    id,
                    data.companyId,
                    data.cardId,
                    data.type ?? null,
                    data.subjectType,
                    data.subjectId,
                    data.subjectName ?? null,
                    data.authorId ?? null,
                    data.authorName ?? null,
                    JSON.stringify(data.answers ?? []),
                ],
            );
            return result.rows[0];
        } catch (error) {
            throw new InternalServerErrorException({
                message: 'Feedback entry create failed',
                error: this.formatErrorDetails(error),
            });
        }
    }
    async findAll(companyId: string, limit = 50) {
        const result = await this.postgres.query<FeedbackEntry>(
            `SELECT ${this.selectFields}
             FROM feedback_entries
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        return result.rows;
    }
    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<FeedbackEntry>(
            `SELECT ${this.selectFields}
             FROM feedback_entries
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        return result.rows[0] ?? null;
    }
    async update(id: string, data: Partial<FeedbackEntry>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (Object.prototype.hasOwnProperty.call(data, 'cardId')) {
            updates.push(`card_id = $${index++}`);
            values.push(data.cardId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'type')) {
            updates.push(`type = $${index++}`);
            values.push(data.type ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'subjectType')) {
            updates.push(`subject_type = $${index++}`);
            values.push(data.subjectType ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'subjectId')) {
            updates.push(`subject_id = $${index++}`);
            values.push(data.subjectId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'subjectName')) {
            updates.push(`subject_name = $${index++}`);
            values.push(data.subjectName ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'authorId')) {
            updates.push(`author_id = $${index++}`);
            values.push(data.authorId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'authorName')) {
            updates.push(`author_name = $${index++}`);
            values.push(data.authorName ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'answers')) {
            updates.push(`answers = $${index++}::jsonb`);
            values.push(JSON.stringify(data.answers ?? []));
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        try {
            const result = await this.postgres.query<FeedbackEntry>(
                `UPDATE feedback_entries
                 SET ${updates.join(', ')}
                 WHERE id = $${index++} AND company_id = $${index}
                 RETURNING ${this.selectFields}`,
                values,
            );
            return result.rows[0] ?? null;
        } catch (error) {
            throw new InternalServerErrorException({
                message: 'Feedback entry update failed',
                error: this.formatErrorDetails(error),
            });
        }
    }
    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM feedback_entries WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

// Controllers
@Controller('feedback-cards')
@UseGuards(AuthGuard, CompanyGuard)
export class FeedbackCardsController {
    constructor(private service: FeedbackCardsService) { }
    @Post() create(@Body() d: FeedbackCard, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        d.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = FeedbackCardSchema.safeParse(d);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as FeedbackCard);
    }
    @Get() findAll(@Req() req, @Query('limit') limit?: string) { return this.service.findAll(req.user.companyId, parseLimit(limit)); }
    @Get(':id') findOne(@Param('id') id: string, @Req() req) { return this.service.findOne(id, req.user.companyId); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackCard>, @Req() req) {
        const updateData = { ...d };
        delete (updateData as Partial<FeedbackCard>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }
    @Delete(':id') remove(@Param('id') id: string, @Req() req) { return this.service.delete(id, req.user.companyId); }
}

@Controller('feedback-entries')
@UseGuards(AuthGuard, CompanyGuard)
export class FeedbackEntriesController {
    constructor(private service: FeedbackEntriesService) { }
    @Post() create(@Body() d: FeedbackEntry, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        d.companyId = user.companyId;

        // 2. Validate and retrieve clean data
        const v = FeedbackEntrySchema.safeParse(d);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 3. Persist validated data
        return this.service.create(v.data as FeedbackEntry);
    }
    @Get() findAll(@Req() req, @Query('limit') limit?: string) { return this.service.findAll(req.user.companyId, parseLimit(limit)); }
    @Get(':id') findOne(@Param('id') id: string, @Req() req) { return this.service.findOne(id, req.user.companyId); }
    @Put(':id') update(@Param('id') id: string, @Body() d: Partial<FeedbackEntry>, @Req() req) {
        const updateData = { ...d };
        delete (updateData as Partial<FeedbackEntry>).companyId;
        return this.service.update(id, updateData, req.user.companyId);
    }
    @Delete(':id') remove(@Param('id') id: string, @Req() req) { return this.service.delete(id, req.user.companyId); }
}

@Module({
    controllers: [FeedbackCardsController, FeedbackEntriesController],
    providers: [FeedbackCardsService, FeedbackEntriesService],
    exports: [FeedbackCardsService, FeedbackEntriesService]
})
export class FeedbackModule { }
