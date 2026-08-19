import { Injectable } from '@nestjs/common';
import { QueueStats } from '../../shared/interfaces/bullmq.interfaces';
import { QueueRegistryService } from '../queue-registry/queue-registry.service';

@Injectable()
export class QueueMonitoringService {
  constructor(private readonly registry: QueueRegistryService) {}

  /** Returns queue counts and the age of the oldest waiting job without scanning the queue. */
  async stats(queueName: string): Promise<QueueStats> {
    const queue = this.registry.get(queueName);
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'prioritized',
      'paused',
      'waiting-children',
    );
    const waiting = await queue.getJobs(['waiting'], 0, 0, true);
    const oldest = waiting[0] ?? null;

    return {
      queueName,
      counts,
      oldestWaitingJobId: oldest?.id != null ? String(oldest.id) : null,
      oldestWaitingAgeMs: oldest ? Math.max(0, Date.now() - oldest.timestamp) : null,
    };
  }
}

export { QueueMonitoringService as QueueMonitorService };
