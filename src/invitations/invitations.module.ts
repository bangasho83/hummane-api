import { BadRequestException, Module, Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Injectable, Query, Req } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { AuthGuard } from '../auth/auth.guard';
import { CompanyGuard } from '../auth/company.guard';
import { UserInvitation, UserInvitationSchema } from '../schemas/core.schema';
import { v4 as uuidv4 } from 'uuid';
import { parseLimit } from '../utils/pagination';
import { createHash, randomBytes } from 'crypto';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class InvitationsService {
    constructor(private postgres: PostgresService) { }

    private selectFields = [
        'id',
        'company_id AS "companyId"',
        'email',
        'invited_by AS "invitedBy"',
        'employee_id AS "employeeId"',
        'status',
        'token_hash AS "tokenHash"',
        'expires_at AS "expiresAt"',
        'accepted_at AS "acceptedAt"',
        'created_at AS "createdAt"',
        'updated_at AS "updatedAt"',
    ].join(', ');

    private toTimestampValue(value?: unknown) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'string') return value;
        if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
            return (value as { toDate: () => Date }).toDate();
        }
        return value;
    }

    private sanitize(invitation: UserInvitation) {
        const { tokenHash, ...rest } = invitation as UserInvitation & { tokenHash?: string };
        return rest;
    }

    async create(data: UserInvitation, rawToken: string | null) {
        const id = data.id || uuidv4();
        const tokenHash = rawToken ? createHash('sha256').update(rawToken).digest('hex') : undefined;
        const result = await this.postgres.query<UserInvitation>(
            `INSERT INTO user_invitations (
                id,
                company_id,
                email,
                invited_by,
                employee_id,
                status,
                token_hash,
                expires_at,
                accepted_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING ${this.selectFields}`,
            [
                id,
                data.companyId,
                data.email,
                data.invitedBy,
                data.employeeId ?? null,
                data.status ?? 'pending',
                tokenHash ?? null,
                this.toTimestampValue(data.expiresAt),
                this.toTimestampValue(data.acceptedAt),
            ],
        );
        return this.sanitize(result.rows[0] as UserInvitation);
    }

    async findAll(companyId: string, status?: string, email?: string, limit = 50) {
        const params: unknown[] = [companyId];
        const clauses: string[] = ['company_id = $1'];
        if (status) {
            params.push(status);
            clauses.push(`status = $${params.length}`);
        }
        if (email) {
            params.push(email);
            clauses.push(`email = $${params.length}`);
        }
        params.push(limit);
        const limitParam = `$${params.length}`;
        const result = await this.postgres.query<UserInvitation>(
            `SELECT ${this.selectFields}
             FROM user_invitations
             WHERE ${clauses.join(' AND ')}
             ORDER BY created_at DESC
             LIMIT ${limitParam}`,
            params,
        );
        return result.rows.map(row => this.sanitize(row));
    }

    async findOne(id: string, companyId: string) {
        const result = await this.postgres.query<UserInvitation>(
            `SELECT ${this.selectFields}
             FROM user_invitations
             WHERE id = $1 AND company_id = $2
             LIMIT 1`,
            [id, companyId],
        );
        const row = result.rows[0];
        return row ? this.sanitize(row) : null;
    }

    async findPendingByEmail(email: string) {
        const result = await this.postgres.query<UserInvitation>(
            `SELECT ${this.selectFields}
             FROM user_invitations
             WHERE email = $1 AND status = 'pending'
             ORDER BY created_at DESC
             LIMIT 1`,
            [email]
        );
        return result.rows[0] ? this.sanitize(result.rows[0]) : null;
    }

    async update(id: string, data: Partial<UserInvitation>, companyId: string) {
        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (Object.prototype.hasOwnProperty.call(data, 'email')) {
            updates.push(`email = $${index++}`);
            values.push(data.email ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'employeeId')) {
            updates.push(`employee_id = $${index++}`);
            values.push(data.employeeId ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'status')) {
            updates.push(`status = $${index++}`);
            values.push(data.status ?? null);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'expiresAt')) {
            updates.push(`expires_at = $${index++}`);
            values.push(this.toTimestampValue(data.expiresAt));
        }
        if (Object.prototype.hasOwnProperty.call(data, 'acceptedAt')) {
            updates.push(`accepted_at = $${index++}`);
            values.push(this.toTimestampValue(data.acceptedAt));
        }

        updates.push('updated_at = now()');
        values.push(id, companyId);

        const result = await this.postgres.query<UserInvitation>(
            `UPDATE user_invitations
             SET ${updates.join(', ')}
             WHERE id = $${index++} AND company_id = $${index}
             RETURNING ${this.selectFields}`,
            values,
        );
        const row = result.rows[0];
        return row ? this.sanitize(row) : null;
    }

    async delete(id: string, companyId: string) {
        await this.postgres.query(
            `DELETE FROM user_invitations WHERE id = $1 AND company_id = $2`,
            [id, companyId],
        );
    }
}

@Controller('invitations')
@UseGuards(AuthGuard, CompanyGuard)
export class InvitationsController {
    constructor(
        private service: InvitationsService,
        private emailService: EmailService,
        private configService: ConfigService
    ) { }

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
            (payload as { expiresAt: Date }).expiresAt = date;
        }

        const result = UserInvitationSchema.safeParse(payload);
        if (!result.success) {
            throw new BadRequestException(result.error.issues);
        }

        const inviteToken = randomBytes(32).toString('hex');
        const created = await this.service.create(result.data as UserInvitation, inviteToken);

        // Send Email
        try {
            const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://hummane.com';
            const signupLink = `${frontendUrl}/signup?email=${encodeURIComponent(created.email)}&token=${inviteToken}&companyId=${created.companyId}`;

            await this.emailService.sendEmail(
                { email: created.email },
                'You have been invited to join Hummane',
                `
                <html>
                    <body>
                        <h3>Hello!</h3>
                        <p>You have been invited to join the team on Hummane.</p>
                        <p>Click the link below to accept your invitation and create your account:</p>
                        <p>
                            <a href="${signupLink}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
                        </p>
                        <p>Or copy this link: ${signupLink}</p>
                    </body>
                </html>
                `
            );
        } catch (e) {
            console.error('Failed to send invitation email', e);
            // Don't fail the request if email fails, but log it
        }

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
            (updateData as { expiresAt: Date }).expiresAt = date;
        }
        if (typeof (updateData as { acceptedAt?: unknown }).acceptedAt === 'string') {
            const date = new Date((updateData as { acceptedAt: string }).acceptedAt);
            if (Number.isNaN(date.getTime())) {
                throw new BadRequestException('acceptedAt must be a valid ISO date string');
            }
            (updateData as { acceptedAt: Date }).acceptedAt = date;
        }

        return this.service.update(id, updateData, req.user.companyId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req) {
        return this.service.delete(id, req.user.companyId);
    }
}

@Module({
    imports: [EmailModule, ConfigModule],
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService]
})
export class InvitationsModule { }
