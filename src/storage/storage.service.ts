import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
    private _bucket: any;

    constructor(private configService: ConfigService) { }

    private get bucket() {
        if (!this._bucket) {
            // Ensure Firebase is initialized
            if (!admin.apps.length) {
                throw new Error('[StorageService] Firebase App not initialized');
            }
            const bucketName = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || 'hummane-76bcd.firebasestorage.app';
            this._bucket = admin.storage().bucket(bucketName);
        }
        return this._bucket;
    }

    async uploadFile(file: Buffer, path: string, fileName: string, contentType: string): Promise<string> {
        const fullPath = `${path}/${fileName}`;
        console.log(`[StorageService] Starting upload: ${fullPath} (${contentType}, ${file.length} bytes)`);

        try {
            const fileRef = this.bucket.file(fullPath);

            await fileRef.save(file, {
                metadata: {
                    contentType: contentType,
                },
                public: true,
            });

            console.log(`[StorageService] Upload successful: ${fullPath}`);

            // Construct the public URL
            return `https://storage.googleapis.com/${this.bucket.name}/${fullPath}`;
        } catch (error) {
            console.error(`[StorageService] Upload failed for ${fullPath}:`, error);
            throw error;
        }
    }
}
