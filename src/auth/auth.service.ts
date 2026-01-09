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

    private ensureFirebaseApp() {
        if (!admin.apps.length) {
            console.log('[AuthInfo] Firebase App not initialized. Initializing now...');
            const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
            if (serviceAccount) {
                try {
                    // Handle quoted JSON string edge case from Vercel env vars
                    let parsedConfig;
                    if (serviceAccount.startsWith("'") && serviceAccount.endsWith("'")) {
                        parsedConfig = JSON.parse(serviceAccount.slice(1, -1));
                    } else {
                        parsedConfig = JSON.parse(serviceAccount);
                    }

                    admin.initializeApp({
                        credential: admin.credential.cert(parsedConfig),
                    });
                    console.log('[AuthInfo] Firebase App initialized with Service Account.');
                } catch (error) {
                    console.error('[AuthError] Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
                    // Fallback to default (might fail if no ADC, but better than crashing here)
                    admin.initializeApp();
                }
            } else {
                console.log('[AuthInfo] No FIREBASE_SERVICE_ACCOUNT found. Initializing with default credentials.');
                admin.initializeApp();
            }
        }
    }

    async verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken> {
        this.ensureFirebaseApp();

        try {
            // Log active app details to debug Vercel environment
            const app = admin.app();
            // console.log('[AuthDebug] Active Firebase App Name:', app.name);
            // console.log('[AuthDebug] Active Project ID from App Options:', app.options.projectId);

            return await admin.auth().verifyIdToken(token);
        } catch (error) {
            console.error('[AuthDebug] Token Verification Failed:', error);
            console.error('[AuthDebug] Error Code:', error.code);
            console.error('[AuthDebug] Error Message:', error.message);
            throw new UnauthorizedException(`Invalid Firebase token: ${error.message}`);
        }
    }

    async login(firebaseToken: string) {
        const decodedToken = await this.verifyFirebaseToken(firebaseToken);
        const { email, uid, name, picture } = decodedToken;

        if (!email) {
            throw new UnauthorizedException('Email is required in Firebase token');
        }

        // 1. Check if user exists in Hummane DB
        let user = await this.usersService.findByEmail(email);

        // 2. If not, create user (Sync)
        if (!user) {
            user = await this.usersService.create({
                id: uuidv4(),
                email: email,
                name: name || 'Unknown User',
                createdAt: new Date().toISOString()
            });
        }

        // 3. Issue Hummane JWT
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            companyId: user.companyId
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: user,
        };
    }

    async validateUser(payload: JwtPayload) {
        return this.usersService.findOne(payload.sub);
    }
}
