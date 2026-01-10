import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../firestore/firestore.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('debug')
export class DebugController {
    constructor(private firestoreService: FirestoreService) { }

    @Get('users')
    async getUsers() {
        try {
            // 1. Check current Project ID being used
            let projectId = 'unknown';
            if (admin.apps.length) {
                projectId = admin.app().options.projectId || 'undefined';
            }

            // 2. Try to read from Firestore
            const snapshot = await this.firestoreService.getCollection('users').limit(10).get();
            const users = snapshot.docs.map(doc => doc.data());

            return {
                status: 'success',
                projectId,
                userCount: users.length,
                firebaseAppCount: admin.apps.length,
                env: {
                    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                }
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                code: error.code,
                projectId: admin.apps.length ? admin.app().options.projectId : 'none',
                env: {
                    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                    serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 0,
                    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
                    projectIdValue: process.env.FIREBASE_PROJECT_ID, // Safe to show project ID
                    nodeEnv: process.env.NODE_ENV
                }
            };
        }
    }

    @Get('env-check')
    envCheck() {
        return {
            hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
            serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.length : 0,
            hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
            projectIdValue: process.env.FIREBASE_PROJECT_ID,
        };
    }

    @Get('parse-check')
    parseCheck() {
        const sa = process.env.FIREBASE_SERVICE_ACCOUNT || '';
        const results: any = {
            rawLength: sa.length,
            startsWithQuote: sa.startsWith("'"),
            endsWithQuote: sa.endsWith("'"),
            containsNewlines: sa.includes('\n'),
            containsEscapedNewlines: sa.includes('\\n'),
        };

        try {
            // 1. Try raw parse
            JSON.parse(sa);
            results.rawParse = 'Success';
        } catch (e) {
            results.rawParse = `Failed: ${e.message}`;
        }

        try {
            // 2. Try unquoting
            let unquoted = sa;
            if (sa.startsWith("'") && sa.endsWith("'")) {
                unquoted = sa.slice(1, -1);
            }
            JSON.parse(unquoted);
            results.unquotedParse = 'Success';
        } catch (e) {
            results.unquotedParse = `Failed: ${e.message}`;
        }

        return results;
    }
    @Get('auth-session')
    @UseGuards(AuthGuard)
    authSession(@Req() req) {
        return {
            message: 'Authentication session is active',
            user: req.user
        };
    }
}
