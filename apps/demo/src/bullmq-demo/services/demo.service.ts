import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueueRegistryService, QueueService } from '@app/bullmq';
import { DEMO_JOB, DEMO_QUEUE } from '../../shared/constants/demo.constants';
import {
  BulkDto,
  DelayedDto,
  EnqueueJobDto,
  LoadDto,
  PriorityDto,
  RetryJobDto,
} from '../dto/job.dto';
import { conflictMessageFrom } from '../helpers/conflict-message.helper';

@Injectable()
export class DemoService {
  constructor(
    private readonly queues: QueueService,
    private readonly registry: QueueRegistryService,
  ) {}

  /** Enqueues a standard demo job. */
  normal(dto: EnqueueJobDto) {
    return this.queues.enqueue(DEMO_QUEUE, DEMO_JOB, this.data(dto), { attempts: dto.attempts });
  }

  /** Enqueues demo jobs using BullMQ bulk chunks. */
  bulk(dto: BulkDto) {
    return this.queues.enqueueBulk(
      DEMO_QUEUE,
      dto.jobs.map((j, sequence) => ({
        name: DEMO_JOB,
        data: this.data(j, sequence),
        opts: { attempts: j.attempts },
      })),
      dto.chunkSize ?? 100,
    );
  }

  /** Enqueues a demo job with a BullMQ delay. */
  delayed(dto: DelayedDto) {
    return this.queues.enqueueDelayed(DEMO_QUEUE, DEMO_JOB, this.data(dto), dto.delayMs, {
      attempts: dto.attempts,
    });
  }

  /** Enqueues a job configured to fail deterministically before retrying. */
  retry(dto: RetryJobDto) {
    return this.queues.enqueue(
      DEMO_QUEUE,
      DEMO_JOB,
      this.data({ ...dto, failUntilAttempt: dto.failUntilAttempt ?? 1 }),
      {
        attempts: dto.attempts ?? 3,
        backoff: { type: dto.backoffType ?? 'fixed', delay: dto.backoffDelayMs ?? 100 },
      },
    );
  }

  /** Enqueues a demo job with BullMQ priority. */
  priority(dto: PriorityDto) {
    return this.queues.enqueue(DEMO_QUEUE, DEMO_JOB, this.data(dto), {
      priority: dto.priority,
      attempts: dto.attempts,
    });
  }

  /** Generates a bounded load batch for the demo queue. */
  async load(dto: LoadDto) {
    const jobs = Array.from({ length: dto.count }, (_, i) => ({
      message: `load-${i}`,
      failUntilAttempt: dto.deterministicFailures && i % 10 === 0 ? 1 : undefined,
    }));

    return this.bulk({ jobs, chunkSize: dto.chunkSize });
  }

  /** Returns demo queue monitoring stats. */
  stats() {
    return this.queues.getStats(DEMO_QUEUE);
  }

  /** Returns one demo job or raises a not-found error. */
  async get(id: string) {
    const job = await this.queues.getJob(DEMO_QUEUE, id);
    if (!job) throw new NotFoundException('Job not found');

    return job;
  }

  /** Removes one demo job or reports a state conflict from BullMQ. */
  async remove(id: string) {
    try {
      if (!(await this.queues.removeJob(DEMO_QUEUE, id)))
        throw new NotFoundException('Job not found');

      return { removed: true, id };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;

      throw new ConflictException(conflictMessageFrom(err));
    }
  }

  /** Retries one failed demo job or reports a state conflict from BullMQ. */
  async retryJob(id: string) {
    try {
      if (!(await this.queues.retryJob(DEMO_QUEUE, id)))
        throw new NotFoundException('Job not found');

      return { retried: true, id };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;

      throw new ConflictException(conflictMessageFrom(err));
    }
  }

  /** Checks Redis readiness through the demo queue connection with a bounded timeout. */
  async ready() {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise(
      (_, reject) =>
        (timeoutHandle = setTimeout(() => reject(new Error('Redis readiness timeout')), 500)),
    );

    try {
      await Promise.race([this.registry.get(DEMO_QUEUE).waitUntilReady(), timeout]);

      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Redis unavailable');
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private data(dto: EnqueueJobDto, sequence?: number) {
    return {
      message: dto.message,
      payload: dto.payload,
      failUntilAttempt: dto.failUntilAttempt,
      enqueuedAt: Date.now(),
      sequence,
    };
  }
}
