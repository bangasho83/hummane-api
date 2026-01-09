import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirestoreService implements OnModuleInit {
    // Removed cached `db` property to prevent stale references if App is re-initialized

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        if (!admin.apps.length) {
            const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
            if (serviceAccount) {
                try {
                    let parsedConfig;
                    // Handle Vercel environment variable edge case
                    if (serviceAccount.startsWith("'") && serviceAccount.endsWith("'")) {
                        parsedConfig = JSON.parse(serviceAccount.slice(1, -1));
                    } else {
                        parsedConfig = JSON.parse(serviceAccount);
                    }

                    const envProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

                    admin.initializeApp({
                        credential: admin.credential.cert(parsedConfig),
                        projectId: envProjectId || parsedConfig.project_id,
                    });
                    console.log(`[FirestoreInfo] Firebase App initialized for project: ${envProjectId || parsedConfig.project_id}`);
                } catch (error) {
                    console.error('[FirestoreError] Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
                    admin.initializeApp();
                }
            } else {
                console.log('[FirestoreInfo] No FIREBASE_SERVICE_ACCOUNT found. Initializing with default credentials.');
                admin.initializeApp();
            }
        }
        // Do NOT cache admin.firestore() here
    }

    getCollection(collectionName: string) {
        // Always get the current Firestore instance attached to the active App
        return admin.firestore().collection(collectionName);
    }
}
