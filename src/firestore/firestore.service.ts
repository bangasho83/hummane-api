import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirestoreService implements OnModuleInit {
    private db: FirebaseFirestore.Firestore;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        if (!admin.apps.length) {
            const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
            if (serviceAccount) {
                try {
                    let parsedConfig;
                    // Handle Vercel environment variable edge case (wrapped in single quotes)
                    if (serviceAccount.startsWith("'") && serviceAccount.endsWith("'")) {
                        parsedConfig = JSON.parse(serviceAccount.slice(1, -1));
                    } else {
                        parsedConfig = JSON.parse(serviceAccount);
                    }

                    const envProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

                    admin.initializeApp({
                        credential: admin.credential.cert(parsedConfig),
                        projectId: envProjectId || parsedConfig.project_id, // Prioritize env var
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
        this.db = admin.firestore();
    }

    getCollection(collectionName: string) {
        return this.db.collection(collectionName);
    }
}
