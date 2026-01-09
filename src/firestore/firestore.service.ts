import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirestoreService implements OnModuleInit {
    private db: FirebaseFirestore.Firestore;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

        if (!admin.apps.length) {
            if (serviceAccount) {
                admin.initializeApp({
                    credential: admin.credential.cert(JSON.parse(serviceAccount)),
                });
            } else {
                // Fallback or development mode if needed, potentially use ADC
                admin.initializeApp();
            }
        }
        this.db = admin.firestore();
    }

    getCollection(collectionName: string) {
        return this.db.collection(collectionName);
    }
}
