import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT');
  // app.enableCors({
  //   origin: ['http://localhost:3000'],
  //   preflightContinue: false,
  //   credentials: true,
  // });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
  app.use(
    '/stripe/subscription-webhook',
    express.raw({ type: 'application/json' }),
  );
  await app.listen(port);
}
bootstrap();
