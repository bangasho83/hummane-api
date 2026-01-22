import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { EmployeesService } from '../employees/employees.service';
import { JwtPayload } from './auth.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private companiesService: CompaniesService,
        private employeesService: EmployeesService,
        private configService: ConfigService,
    ) { }

    private async ensureFirebaseApp() {
        // If app exists but has no project ID, it might be a bad init from another module.
        if (admin.apps.length && !admin.app().options.projectId) {
            console.log('[AuthInfo] Existing Firebase App missing Project ID. Deleting and re-initializing...');
            try {
                await admin.app().delete();
            } catch (e) {
                console.error('[AuthError] Failed to delete existing app:', e);
            }
        }

        if (!admin.apps.length) {
            console.log('[AuthInfo] Firebase App not initialized. Initializing now...');
            const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
            // Log if env vars are present (safe to log boolean existence)
            console.log('[AuthInfo] Has Service Account:', !!serviceAccount);
            const envProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
            console.log('[AuthInfo] Has Project ID Env:', !!envProjectId, envProjectId);

            if (serviceAccount) {
                try {
                    let parsedConfig;
                    if (serviceAccount.startsWith("'") && serviceAccount.endsWith("'")) {
                        parsedConfig = JSON.parse(serviceAccount.slice(1, -1));
                    } else {
                        parsedConfig = JSON.parse(serviceAccount);
                    }

                    const finalProjectId = envProjectId || parsedConfig.project_id;

                    admin.initializeApp({
                        credential: admin.credential.cert(parsedConfig),
                        projectId: finalProjectId,
                    });
                    console.log(`[AuthInfo] Firebase App initialized for project: ${finalProjectId}`);
                } catch (error) {
                    console.error('[AuthError] Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
                    // Force re-init with just project ID if Service Account parse failed but we have project ID?
                    // No, verifyIdToken NEEDS the private key.
                    // Fallback to ADC
                    admin.initializeApp({ projectId: envProjectId });
                }
            } else {
                console.log('[AuthInfo] No FIREBASE_SERVICE_ACCOUNT found. Initializing with ADC/Env vars.');
                admin.initializeApp({ projectId: envProjectId });
            }
        }
    }

    async verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken> {
        await this.ensureFirebaseApp();

        try {
            return await admin.auth().verifyIdToken(token);
        } catch (error) {
            console.error('[AuthDebug] Token Verification Failed:', error);
            const currentProjectId = admin.apps.length ? admin.app().options.projectId : 'NO_APP';
            throw new UnauthorizedException(`Invalid Firebase token. ProjectId: ${currentProjectId}. Error: ${error.message}`);
        }
    }

    async login(firebaseToken: string) {
        let loginEmail: string | undefined;
        try {
            const decodedToken = await this.verifyFirebaseToken(firebaseToken);
            const { email, uid, name, picture } = decodedToken;
            loginEmail = email;

            if (!email) {
                throw new UnauthorizedException('Email is required in Firebase token');
            }

            console.log(`[AuthDebug] Login attempt for: ${email}`);
            let user = await this.usersService.findByEmail(email);

            if (!user) {
                user = await this.usersService.create({
                    id: uuidv4(),
                    email: email,
                    name: name || 'Unknown User',
                    role: 'member'
                });
            }

            // 3. Resolve Company
            let company = null;
            if (user.companyId) {
                company = await this.companiesService.findOne(user.companyId);
            } else {
                // Self-healing: Look for company owned by user.id (NOT uid)
                company = await this.companiesService.findByOwner(user.id);
                if (company) {
                    await this.usersService.update(user.id, { companyId: company.id });
                    user.companyId = company.id;
                }
            }

            // EXTRA PROTECTION: If companyId is falsy or "undefined" string, treat as null
            if (!user.companyId || user.companyId === 'undefined') {
                user.companyId = undefined;
                company = null;
            }

            // 4. Look up employee record if user has a company
            let employeeId: string | undefined;
            if (user.companyId) {
                const employee = await this.employeesService.findByUserId(user.id, user.companyId);
                employeeId = employee?.id;
            }

            const payload: JwtPayload = {
                sub: user.id,
                email: user.email,
                companyId: user.companyId,
                employeeId: employeeId,
                role: (user as any).role // Use assertion until User type is fully updated in all places
            };

            console.log(`[AuthDebug] JWT Payload established:`, JSON.stringify(payload));

            return {
                access_token: await this.jwtService.signAsync(payload),
                user: user,
                company: company,
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            const details = {
                name: (error as Error)?.name,
                code: (error as { code?: string | number })?.code,
                message: (error as Error)?.message,
                email: loginEmail,
            };
            console.error('[AuthError] Login failed:', details);

            throw new InternalServerErrorException({
                message: 'Auth login failed',
                error: details,
            });
        }
    }

    async validateUser(payload: JwtPayload) {
        return this.usersService.findOne(payload.sub);
    }
}
