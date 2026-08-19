import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { QueueRegistryService } from '../queue-registry/queue-registry.service';
import { WorkerManagerService } from '../worker-manager/worker-manager.service';

@Injectable()
export class BullMqLifecycleService implements OnApplicationShutdown {
  constructor(
    private readonly workers: WorkerManagerService,
    private readonly queues: QueueRegistryService,
  ) {}

  /** Closes workers before queues during application shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.workers.closeAll();
    await this.queues.closeAll();
  }
}
