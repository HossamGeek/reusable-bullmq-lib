import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DemoWorkerModule } from './worker.module';
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(DemoWorkerModule);
  app.enableShutdownHooks();
}
void bootstrap();
