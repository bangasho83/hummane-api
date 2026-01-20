import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter()
    );

    // Register multipart support
    await app.register(fastifyMultipart, {
        limits: {
            fieldNameSize: 100, // Max field name size in bytes
            fieldSize: 10240,    // 10KB
            fields: 20,         // Max number of non-file fields
            fileSize: 5242880,  // 5MB
            files: 1,           // Max number of file fields
        },
    });

    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    });

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
