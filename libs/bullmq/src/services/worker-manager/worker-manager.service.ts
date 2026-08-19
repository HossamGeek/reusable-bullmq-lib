import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Worker } from 'bullmq';
import { BULLMQ_OPTIONS, BULLMQ_WORKER_DEFINITIONS } from '../../shared/constants/tokens';
import { BullMqRootOptions, WorkerDefinition } from '../../shared/interfaces/bullmq.interfaces';

@Injectable()
export class WorkerManagerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerManagerService.name);
  private readonly workers: Worker[] = [];

  constructor(
    @Inject(BULLMQ_OPTIONS) private readonly options: BullMqRootOptions,
    @Optional()
    @Inject(BULLMQ_WORKER_DEFINITIONS)
    private readonly definitions: WorkerDefinition[] = [],
  ) {}

  /** Registers workers provided through the module options. */
  onModuleInit(): void {
    for (const definition of this.definitions) this.registerWorker(definition);
  }

  /** Creates and tracks a BullMQ worker for later lifecycle shutdown. */
  registerWorker(definition: WorkerDefinition): Worker {
    const worker = new Worker(definition.queueName, definition.processor, {
      ...definition.options,
      connection: this.options.connection,
      prefix: this.options.queuePrefix,
    });

    worker.on('failed', (job, err) =>
      this.logger.warn(
        `job failed queue=${definition.queueName} id=${job?.id ?? 'unknown'} reason=${err.message}`,
      ),
    );
    worker.on('error', (err) =>
      this.logger.error(`worker error queue=${definition.queueName}: ${err.message}`),
    );
    this.workers.push(worker);

    return worker;
  }

  /** Closes all workers managed by this application context. */
  async closeAll(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }
}
