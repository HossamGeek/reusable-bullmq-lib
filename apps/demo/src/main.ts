import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification/notification.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NotificationModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`demo app listening on http://localhost:${port}`);
}

void bootstrap();
