import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { FirestoreModule } from '../firestore/firestore.module';

@Module({
    imports: [FirestoreModule],
    controllers: [DebugController],
})
export class DebugModule { }
