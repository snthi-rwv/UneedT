import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const cfg = app.get(ConfigService);

    app.setGlobalPrefix('api');
    app.use(helmet());
    app.enableCors({ origin: cfg.get('frontendUrl'), credentials: true });
    // Valida y limpia todo lo que llega: los campos desconocidos se rechazan
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.enableShutdownHooks();

    await app.listen(cfg.get<number>('port'));
}
bootstrap();