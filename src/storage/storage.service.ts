import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
    private bucket: any;

    constructor(private configService: ConfigService) {
        // The Firebase App is initialized in FirestoreService onModuleInit
        // Use the specific bucket requested by the user
        const bucketName = this.configService.get<string>('FIREBASE_STORAGE_BUCKET') || 'hummane-76bcd.firebasestorage.app';
        this.bucket = admin.storage().bucket(bucketName);
    }

    async uploadFile(file: Buffer, path: string, fileName: string, contentType: string): Promise<string> {
        const fullPath = `${path}/${fileName}`;
        const fileRef = this.bucket.file(fullPath);

        await fileRef.save(file, {
            metadata: {
                contentType: contentType,
            },
            public: true,
        });

        // Construct the public URL
        // Firebase Storage URLs follow this pattern:
        // https://storage.googleapis.com/[BUCKET_NAME]/[FILE_PATH]
        return `https://storage.googleapis.com/${this.bucket.name}/${fullPath}`;
    }
}
