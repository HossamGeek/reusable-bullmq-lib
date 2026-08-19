import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DemoModule } from './demo.module';
async function bootstrap() {
  const app = await NestFactory.create(DemoModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const port = app.get(ConfigService).getOrThrow<number>('demo.port');
  await app.listen(port);
}
void bootstrap();
