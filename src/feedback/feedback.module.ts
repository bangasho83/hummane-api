import { BadRequestException, ConflictException, InternalServerErrorException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { EmployeesModule } from '../employees/employees.module';
import { EmployeesService } from '../employees/employees.service';
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

    private normalizeCardQuestions(card: FeedbackCard) {
        if (!card || !Array.isArray(card.questions)) return card;
        card.questions = card.questions.map((q: any) => {
            if (q && typeof q === 'object') {
                const questionId = q.questionId || q.id;
                return { ...q, questionId };
            }
            return q;
        });
        return card;
    }

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
            return this.normalizeCardQuestions(result.rows[0]);
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
        return result.rows.map(card => this.normalizeCardQuestions(card));
    }
    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<FeedbackCard>(
            `SELECT ${this.selectFields}
             FROM feedback_cards
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        const card = result.rows[0];
        return card ? this.normalizeCardQuestions(card) : null;
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
            const updated = result.rows[0];
            return updated ? this.normalizeCardQuestions(updated) : null;
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
                throw new ConflictException({
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

    private normalizeCardQuestions(card: FeedbackCard) {
        if (!card || !Array.isArray(card.questions)) return card;
        card.questions = card.questions.map((q: any) => {
            if (q && typeof q === 'object') {
                const questionId = q.questionId || q.id;
                return { ...q, questionId };
            }
            return q;
        });
        return card;
    }

    private buildQuestionKindMap(questions: unknown) {
        const map = new Map<string, string>();
        if (!Array.isArray(questions)) return map;
        questions.forEach((question) => {
            if (!question || typeof question !== 'object') return;
            const q = question as { id?: string; kind?: string };
            if (q.id) {
                map.set(q.id, (q.kind ?? '').toString().toLowerCase());
            }
        });
        return map;
    }

    private enrichAnswersWithQuestionData(entry: FeedbackEntry, card: FeedbackCard) {
        if (!Array.isArray(entry.answers) || !Array.isArray(card.questions)) return entry;

        // 1. Normalize the card to ensure we have a common ID field (questionId)
        const normalizedCard = this.normalizeCardQuestions({ ...card });
        const questions = normalizedCard.questions as any[];

        // 2. Prepare answer lookup map (by questionId)
        const answerMap = new Map<string, any>();
        entry.answers.forEach((a: any) => {
            if (a?.questionId) answerMap.set(a.questionId, a);
        });

        // 3. Prepare question lookup map (by questionId) for top-level answer enrichment
        const questionMap = new Map<string, any>();
        questions.forEach((q: any) => {
            if (q.questionId) questionMap.set(q.questionId, q);
        });

        // 4. Enrich top-level answers with question metadata
        entry.answers = entry.answers.map((a: any) => {
            if (!a || typeof a !== 'object') return a;
            const qData = a.questionId ? questionMap.get(a.questionId) : null;
            return qData ? { ...a, question: qData } : a;
        });

        // 5. Build nested card structure with answers inside questions
        // Fallback: If ID matching fails, we try to match by index for non-content blocks
        const answerableQuestions = questions.filter(q => q.kind !== 'content');

        entry.card = {
            ...normalizedCard,
            questions: questions.map((q: any) => {
                let matchingAnswer = null;

                if (q.questionId) {
                    matchingAnswer = answerMap.get(q.questionId);
                }

                // Fallback to index-based matching if no ID match and not a content block
                if (!matchingAnswer && q.kind !== 'content') {
                    const qIndex = answerableQuestions.indexOf(q);
                    if (qIndex !== -1 && entry.answers[qIndex]) {
                        matchingAnswer = entry.answers[qIndex];
                    }
                }

                if (matchingAnswer) {
                    // Inject full answer (minus 'question' back-ref to avoid circularity)
                    const { question, ...answerOnly } = matchingAnswer;
                    return { ...q, answer: answerOnly };
                }

                return q;
            }),
        };

        return entry;
    }

    private stripCommentScores(entry: FeedbackEntry, questionKindMap?: Map<string, string>) {
        if (!Array.isArray(entry.answers)) return entry;
        const kindMap = questionKindMap ?? new Map<string, string>();
        const answers = entry.answers.map((answer) => {
            if (!answer || typeof answer !== 'object') return answer;
            const a = answer as { questionId?: string; score?: unknown; comment?: unknown; answer?: unknown;[key: string]: unknown };
            const kind = a.questionId ? kindMap.get(a.questionId) : undefined;
            if (kind === 'comment' || Object.prototype.hasOwnProperty.call(a, 'comment')) {
                const { score, ...rest } = a;
                return rest;
            }
            return answer;
        });
        return { ...entry, answers };
    }

    private async applyCommentRule(entry: FeedbackEntry) {
        if (!entry?.cardId) return entry;
        const result = await this.postgres.query<FeedbackCard>(
            `SELECT id, company_id AS "companyId", title, subject, questions, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM feedback_cards
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [entry.cardId, entry.companyId],
        );
        const card = result.rows[0];
        if (!card) return entry;

        // Normalize question IDs
        this.normalizeCardQuestions(card);

        // 1. Attach the full card object
        entry.card = card;

        // 2. Enrich answers with specific question metadata
        this.enrichAnswersWithQuestionData(entry, card);

        const questionKindMap = this.buildQuestionKindMap(card.questions);
        return this.stripCommentScores(entry, questionKindMap);
    }

    private selectFields = [
        'fe.id',
        'fe.company_id AS "companyId"',
        'fe.card_id AS "cardId"',
        'fe.type',
        'fe.subject_type AS "subjectType"',
        'fe.subject_id AS "subjectId"',
        'fe.subject_name AS "subjectName"',
        'fe.author_id AS "authorId"',
        'author.name AS "authorName"',
        'author.employee_id AS "authorEmployeeId"',
        'fe.answers',
        'fe.created_at AS "createdAt"',
        'fe.updated_at AS "updatedAt"',
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
                    answers
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
                RETURNING id`,
                [
                    id,
                    data.companyId,
                    data.cardId,
                    data.type ?? null,
                    data.subjectType,
                    data.subjectId,
                    data.subjectName ?? null,
                    data.authorId ?? null,
                    JSON.stringify(data.answers ?? []),
                ],
            );
            return this.findOne(result.rows[0].id, data.companyId);
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
             FROM feedback_entries fe
             LEFT JOIN employees author ON author.id = fe.author_id AND author.company_id = fe.company_id
             WHERE fe.company_id = $1
             ORDER BY fe.created_at DESC
             LIMIT $2`,
            [companyId, limit],
        );
        const entries = result.rows;
        if (!entries.length) return entries;
        const cardIds = [...new Set(entries.map(entry => entry.cardId).filter(Boolean))] as string[];
        if (!cardIds.length) return entries;
        const cardsResult = await this.postgres.query<FeedbackCard>(
            `SELECT id, company_id AS "companyId", title, subject, questions, created_at AS "createdAt", updated_at AS "updatedAt"
             FROM feedback_cards
             WHERE company_id = $1 AND id = ANY($2)`,
            [companyId, cardIds],
        );

        const cardMap = new Map<string, FeedbackCard>();
        const questionMapByCard = new Map<string, Map<string, string>>();

        cardsResult.rows.forEach((card) => {
            const normalized = this.normalizeCardQuestions(card);
            cardMap.set(normalized.id, normalized);
            questionMapByCard.set(normalized.id, this.buildQuestionKindMap(normalized.questions));
        });

        return entries.map(entry => {
            const card = entry.cardId ? cardMap.get(entry.cardId) : null;
            if (card) {
                // 1. Attach card
                entry.card = card;
                // 2. Enrich answers
                this.enrichAnswersWithQuestionData(entry, card);
            }
            return this.stripCommentScores(entry, questionMapByCard.get(entry.cardId));
        });
    }
    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<FeedbackEntry>(
            `SELECT ${this.selectFields}
             FROM feedback_entries fe
             LEFT JOIN employees author ON author.id = fe.author_id AND author.company_id = fe.company_id
             WHERE fe.id = $1 AND fe.company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        const entry = result.rows[0];
        if (!entry) return null;
        return this.applyCommentRule(entry);
    }
    async update(id: string, data: Partial<FeedbackEntry>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (Object.prototype.hasOwnProperty.call(data, 'answers')) {
            updates.push(`answers = $${index++}::jsonb`);
            values.push(JSON.stringify(data.answers ?? []));
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        try {
            const result = await this.postgres.query<{ id: string }>(
                `UPDATE feedback_entries
                 SET ${updates.join(', ')}
                 WHERE id = $${index++} AND company_id = $${index}
                 RETURNING id`,
                values,
            );
            const updated = result.rows[0];
            if (!updated) return null;
            return this.findOne(updated.id, companyId);
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
    constructor(
        private service: FeedbackEntriesService,
        private usersService: UsersService,
        private employeesService: EmployeesService
    ) { }
    @Post() async create(@Body() d: FeedbackEntry, @Req() req) {
        const user = req.user;
        // 1. Force companyId from token
        d.companyId = user.companyId;

        // 2. Auto-populate authorId with Employee UUID if missing
        if (!d.authorId) {
            const employee = await this.employeesService.findByUserId(user.id, user.companyId);
            if (employee) d.authorId = employee.id;
        }

        // 3. Validate and retrieve clean data
        const v = FeedbackEntrySchema.safeParse(d);
        if (!v.success) {
            throw new BadRequestException(v.error.issues);
        }

        // 4. Persist validated data
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
    imports: [UsersModule, EmployeesModule],
    controllers: [FeedbackCardsController, FeedbackEntriesController],
    providers: [FeedbackCardsService, FeedbackEntriesService],
    exports: [FeedbackCardsService, FeedbackEntriesService]
})
export class FeedbackModule { }
