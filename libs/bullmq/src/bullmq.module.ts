import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  BULLMQ_OPTIONS,
  BULLMQ_QUEUE_DEFINITIONS,
  BULLMQ_WORKER_DEFINITIONS,
} from './shared/constants/tokens';
import {
  BullMqModuleAsyncOptions,
  BullMqRootOptions,
  QueueDefinition,
  WorkerDefinition,
} from './shared/interfaces/bullmq.interfaces';
import { BullMqLifecycleService } from './services/lifecycle/bullmq-lifecycle.service';
import { QueueMonitoringService } from './services/monitoring/queue-monitoring.service';
import { QueueService } from './services/queue/queue.service';
import { QueueRegistryService } from './services/queue-registry/queue-registry.service';
import { WorkerManagerService } from './services/worker-manager/worker-manager.service';

@Module({})
export class BullMqModule {
  static forRoot(
    options: BullMqRootOptions,
    queues: QueueDefinition[] = [],
    workers: WorkerDefinition[] = [],
  ): DynamicModule {
    return this.build([{ provide: BULLMQ_OPTIONS, useValue: options }], queues, workers);
  }
  static forRootAsync(options: BullMqModuleAsyncOptions): DynamicModule {
    return {
      ...this.build(
        [{ provide: BULLMQ_OPTIONS, inject: options.inject ?? [], useFactory: options.useFactory }],
        options.queues ?? [],
        options.workers ?? [],
      ),
      imports: options.imports ?? [],
    };
  }
  private static build(
    providers: Provider[],
    queues: QueueDefinition[],
    workers: WorkerDefinition[],
  ): DynamicModule {
    return {
      module: BullMqModule,
      providers: [
        ...providers,
        { provide: BULLMQ_QUEUE_DEFINITIONS, useValue: queues },
        { provide: BULLMQ_WORKER_DEFINITIONS, useValue: workers },
        QueueRegistryService,
        QueueService,
        QueueMonitoringService,
        WorkerManagerService,
        BullMqLifecycleService,
      ],
      exports: [QueueRegistryService, QueueService, QueueMonitoringService, WorkerManagerService],
    };
  }
}
