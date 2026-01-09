import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as admin from 'firebase-admin';
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
    ) { }

    async verifyFirebaseToken(token: string): Promise<admin.auth.DecodedIdToken> {
        try {
            // Log active app details to debug Vercel environment
            const app = admin.app();
            console.log('[AuthDebug] Active Firebase App Name:', app.name);
            console.log('[AuthDebug] Active Project ID from App Options:', app.options.projectId);
            console.log('[AuthDebug] Service Account Email from Credential:', (app.options.credential as any)?.clientEmail);

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
            // Check if there is a company invitation/pre-creation logic or just create a fresh user
            // For MVP, if no user, we create one. If email matches a company domain owner logic could be here.
            // Or we just create a user with no companyId yet.
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
