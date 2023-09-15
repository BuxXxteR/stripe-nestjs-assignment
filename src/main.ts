import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT');
  app.enableCors({
    origin: [
      configService.get('FRONTEND_BASE_URL'),
      configService.get('RAILWAY_URL'),
      configService.get('LOCALHOST_FRONTEND_BASE_URL'),
      configService.get('LOCALHOST_FRONTEND_BASE_URL1'),
      configService.get('COINBUREAU_RELEASE_URL'),
      configService.get('COINBUREAU_TEST_URL'),
      configService.get('COINBUREAU_URL'),
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Origin',
      'X-Requested-With',
      'Accept',
      'x-client-key',
      'x-client-token',
      'x-client-secret',
      'Authorization',
    ],
  });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(port);
}
bootstrap();
