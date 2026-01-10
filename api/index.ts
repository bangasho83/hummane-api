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
        });
        await app.init();
    }

    // Fastify needs to be ready before handling requests
    const instance = app.getHttpAdapter().getInstance();
    await instance.ready();

    // Forward the request to Fastify's internal Node server
    instance.server.emit('request', req, res);
}
