import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

let app: NestFastifyApplication;

export default async function handler(req: any, res: any) {
    if (!app) {
        app = await NestFactory.create<NestFastifyApplication>(
            AppModule,
            new FastifyAdapter()
        );
        app.enableCors({
            origin: true,
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
            credentials: true,
            allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
        });
        await app.init();
    }

    const instance = app.getHttpAdapter().getInstance();

    // Handle OPTIONS manually if needed, but instance.ready() + emit should work 
    // if Nest CORS is configured.
    await instance.ready();
    instance.server.emit('request', req, res);
}
