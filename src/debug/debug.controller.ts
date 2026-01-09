import { Controller, Get } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from '../firestore/firestore.service';

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
                users: users, // Return actual data to verify it's the right DB
                firebaseAppCount: admin.apps.length
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                code: error.code,
                projectId: admin.apps.length ? admin.app().options.projectId : 'none'
            };
        }
    }
}
