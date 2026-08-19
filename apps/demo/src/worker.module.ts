import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullMqModule, BullMqRootOptions, WorkerManagerService } from '@app/bullmq';
import { createDemoProcessor } from './bullmq-demo/workers/demo.processor';
import { demoConfig } from './shared/config/demo.config';
import { validateEnv } from './shared/config/env.validation';
import { DEMO_QUEUE } from './shared/constants/demo.constants';
import type { DemoWorkerConfig } from './shared/interfaces/demo-worker-config.interface';
@Injectable()
class DemoWorkerBootstrap implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly workers: WorkerManagerService,
  ) {}
  onModuleInit(): void {
    const worker = this.config.getOrThrow<DemoWorkerConfig>('demo.worker');
    this.workers.registerWorker({
      queueName: DEMO_QUEUE,
      processor: createDemoProcessor(worker.id),
      options: {
        concurrency: worker.concurrency,
        limiter: { max: worker.limiterMax, duration: worker.limiterDurationMs },
      },
    });
  }
}
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
  providers: [DemoWorkerBootstrap],
})
export class DemoWorkerModule {}
