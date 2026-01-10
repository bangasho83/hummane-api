import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { JwtPayload } from './auth.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService,
        private companiesService: CompaniesService,
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
        try {
            const decodedToken = await this.verifyFirebaseToken(firebaseToken);
            const { email, uid, name, picture } = decodedToken;

            if (!email) {
                throw new UnauthorizedException('Email is required in Firebase token');
            }

            console.log(`[AuthDebug] Looking for user with email: ${email}`);
            // 1. Check if user exists in Hummane DB
            let user = await this.usersService.findByEmail(email);
            console.log(`[AuthDebug] User found: ${!!user}`);

            // 2. If not, create user (Sync)
            if (!user) {
                console.log('[AuthDebug] Creating new user...');
                user = await this.usersService.create({
                    id: uuidv4(),
                    email: email,
                    name: name || 'Unknown User',
                    createdAt: new Date().toISOString()
                });
                console.log('[AuthDebug] User created.');
            }

            // 3. Issue Hummane JWT
            const payload: JwtPayload = {
                sub: user.id,
                email: user.email,
                companyId: user.companyId
            };

            // 4. Fetch Company Details
            let company = null;
            if (user.companyId) {
                console.log(`[AuthDebug] Fetching company details for ID: ${user.companyId}`);
                company = await this.companiesService.findOne(user.companyId);
            } else {
                // Self-healing: Look for company owned by user if companyId is missing on profile
                console.log(`[AuthDebug] User profile missing companyId. Searching for owned company for: ${user.id}`);
                company = await this.companiesService.findByOwner(user.id);
                if (company) {
                    console.log(`[AuthDebug] Found owned company: ${company.id}. Updating user profile.`);
                    // Update user profile in background to save this link
                    await this.usersService.update(user.id, { companyId: company.id });
                    user.companyId = company.id; // Update local object for JWT payload consistency if needed (though payload is already signed)
                }
            }

            return {
                access_token: this.jwtService.sign(payload),
                user: user,
                company: company,
            };
        } catch (error) {
            console.error('[AuthDebug] Login failed:', error);
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    async validateUser(payload: JwtPayload) {
        return this.usersService.findOne(payload.sub);
    }
}
