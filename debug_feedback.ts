
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { FeedbackEntriesService } from './src/feedback/feedback.module';
import { PostgresService } from './src/postgres/postgres.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const service = app.get(FeedbackEntriesService);

    const companyId = 'eb7ca4b2-bf78-4489-844e-b67d6910497e';
    const authorId = 'a0411075-fa2f-4e4e-9bd1-aa30bd56abbe'; // The one from CURL
    const subjectId = 'a0411075-fa2f-4e4e-9bd1-aa30bd56abbe'; // The one from CURL

    console.log('--- TEST 1: Filter by Subject ID (Should return 1 record) ---');
    const subjectResults = await service.findAll(companyId, 50, undefined, subjectId);
    console.log(`Found: ${subjectResults.length} records`);
    if (subjectResults.length > 0) {
        console.log('First record ID:', subjectResults[0].id);
        console.log('Subject ID:', subjectResults[0].subjectId);
    }

    console.log('\n--- TEST 2: Filter by Author ID (Should return 0 records) ---');
    const authorResults = await service.findAll(companyId, 50, authorId, undefined);
    console.log(`Found: ${authorResults.length} records`);
    if (authorResults.length > 0) {
        console.log('First record ID:', authorResults[0].id);
        console.log('Author ID:', authorResults[0].authorId);
    }

    await app.close();
}

bootstrap();
