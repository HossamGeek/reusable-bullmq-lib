import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullMqModule, BullMqRootOptions } from '@app/bullmq';
import { DemoController } from './bullmq-demo/controllers/demo.controller';
import { DemoService } from './bullmq-demo/services/demo.service';
import { DEMO_QUEUE } from './shared/constants/demo.constants';
import { demoConfig } from './shared/config/demo.config';
import { validateEnv } from './shared/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [demoConfig], validate: validateEnv }),
    BullMqModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): BullMqRootOptions => ({
        connection: config.getOrThrow('demo.redis'),
        queuePrefix: config.getOrThrow('demo.queuePrefix'),
        defaultJobOptions: {
          attempts: config.getOrThrow('demo.defaultJobAttempts'),
          removeOnComplete: config.getOrThrow('demo.removeOnComplete'),
          removeOnFail: config.getOrThrow('demo.removeOnFail'),
        },
      }),
      queues: [{ name: DEMO_QUEUE }],
    }),
  ],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
