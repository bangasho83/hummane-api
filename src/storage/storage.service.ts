import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
    private _bucket: any;

    constructor(private configService: ConfigService) { }

    private async ensureFirebaseApp() {
        if (!admin.apps.length) {
            console.log('[StorageService] Firebase App not initialized. Initializing now...');
            const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
            const envProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');

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
                    console.log(`[StorageService] Firebase App initialized for project: ${finalProjectId}`);
                } catch (error) {
                    console.error('[StorageService] Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
                    admin.initializeApp({ projectId: envProjectId });
                }
            } else {
                console.log('[StorageService] No FIREBASE_SERVICE_ACCOUNT found. Initializing with ADC/Env vars.');
                admin.initializeApp({ projectId: envProjectId });
            }
        }
    }

    private get bucket() {
        if (!this._bucket) {
            // Ensure Firebase is initialized
            if (!admin.apps.length) {
                // If we reach here, it means the global initializer didn't work or hasn't run.
                // We'll try to initialize it ourselves as a fallback.
                throw new Error('[StorageService] Firebase App not initialized. Please ensure FirestoreModule is in AppModule.');
            }
            const bucketName = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || 'hummane-76bcd.firebasestorage.app';
            this._bucket = admin.storage().bucket(bucketName);
        }
        return this._bucket;
    }

    async uploadFile(file: Buffer, path: string, fileName: string, contentType: string): Promise<string> {
        await this.ensureFirebaseApp();
        const fullPath = `${path}/${fileName}`;
        console.log(`[StorageService] Starting upload: ${fullPath} (${contentType}, ${file.length} bytes)`);

        try {
            const bucket = this.bucket;
            const fileRef = bucket.file(fullPath);

            await fileRef.save(file, {
                metadata: {
                    contentType: contentType,
                },
                public: true,
            });

            console.log(`[StorageService] Upload successful: ${fullPath}`);

            // Construct the public URL
            return `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
        } catch (error) {
            console.error(`[StorageService] Upload failed for ${fullPath}:`, error);
            throw error;
        }
    }
}
