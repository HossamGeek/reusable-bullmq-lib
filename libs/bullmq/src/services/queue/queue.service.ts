import { BadRequestException, Injectable } from '@nestjs/common';
import type { JobJson, JobsOptions } from 'bullmq';
import type {
  BulkEnqueueResult,
  EnqueueResult,
  QueueStats,
} from '../../shared/interfaces/bullmq.interfaces';
import { filterJobOptions } from '../../shared/helpers/filter-job-options.helper';
import type { QueueBulkJobInput } from '../../shared/interfaces/queue-job-input.interface';
import { QueueMonitoringService } from '../monitoring/queue-monitoring.service';
import { QueueRegistryService } from '../queue-registry/queue-registry.service';

@Injectable()
export class QueueService {
  constructor(
    private readonly registry: QueueRegistryService,
    private readonly monitor?: QueueMonitoringService,
  ) {}

  /** Adds one job to a registered queue and returns its queue reference. */
  async enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<EnqueueResult> {
    const job = await this.registry.get(queueName).add(jobName, data, filterJobOptions(opts));

    return { id: String(job.id), name: job.name, queueName };
  }

  /** Adds one delayed job after validating the requested delay. */
  async enqueueDelayed<T>(
    queueName: string,
    jobName: string,
    data: T,
    delayMs: number,
    opts?: JobsOptions,
  ): Promise<EnqueueResult> {
    if (!Number.isInteger(delayMs) || delayMs <= 0) {
      throw new BadRequestException('delayMs must be a positive integer');
    }

    return this.enqueue(queueName, jobName, data, { ...filterJobOptions(opts), delay: delayMs });
  }

  /** Adds jobs in BullMQ bulk chunks and returns accepted job references. */
  async enqueueBulk<T>(
    queueName: string,
    jobs: Array<QueueBulkJobInput<T>>,
    chunkSize = 100,
  ): Promise<BulkEnqueueResult> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new BadRequestException('chunkSize must be a positive integer');
    }

    if (!Array.isArray(jobs)) throw new BadRequestException('jobs must be an array');
    if (jobs.length === 0) return { accepted: 0, chunks: 0, jobs: [] };

    const bulkJobs = jobs.map((job) => {
      if (typeof job?.name !== 'string' || job.name.trim().length === 0) {
        throw new BadRequestException('each bulk job requires a name');
      }

      return { name: job.name, data: job.data, opts: filterJobOptions(job.opts) };
    });

    const queue = this.registry.get(queueName);
    const refs: EnqueueResult[] = [];

    for (let i = 0; i < bulkJobs.length; i += chunkSize) {
      const chunk = bulkJobs.slice(i, i + chunkSize);
      const added = await queue.addBulk(chunk);
      refs.push(...added.map((job) => ({ id: String(job.id), name: job.name, queueName })));
    }

    return { accepted: refs.length, chunks: Math.ceil(jobs.length / chunkSize), jobs: refs };
  }

  /** Reads a job snapshot by id, including current state when the job exists. */
  async getJob(queueName: string, id: string) {
    const job = await this.registry.get(queueName).getJob(id);
    if (!job) return null;

    const json: JobJson = job.asJSON();

    return {
      id: String(job.id),
      name: job.name,
      data: json.data,
      attemptsMade: job.attemptsMade,
      opts: job.opts,
      progress: job.progress,
      returnvalue: json.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      state: await job.getState(),
    };
  }

  /** Removes a job when it exists and returns whether a job was found. */
  async removeJob(queueName: string, id: string): Promise<boolean> {
    const job = await this.registry.get(queueName).getJob(id);
    if (!job) return false;

    await job.remove();

    return true;
  }

  /** Retries a failed job when it exists and returns whether a job was found. */
  async retryJob(queueName: string, id: string): Promise<boolean> {
    const job = await this.registry.get(queueName).getJob(id);
    if (!job) return false;

    await job.retry();

    return true;
  }

  /** Returns monitoring stats for a registered queue. */
  async getStats(queueName: string): Promise<QueueStats> {
    if (!this.monitor) throw new Error('QueueMonitoringService unavailable');

    return this.monitor.stats(queueName);
  }

  /** Alias for enqueue retained for callers that prefer BullMQ-like naming. */
  add<T>(queueName: string, jobName: string, data: T, opts?: JobsOptions): Promise<EnqueueResult> {
    return this.enqueue(queueName, jobName, data, opts);
  }

  /** Alias for enqueueBulk that returns only job references. */
  async addBulk<T>(queueName: string, jobs: Array<QueueBulkJobInput<T>>): Promise<EnqueueResult[]> {
    return (await this.enqueueBulk(queueName, jobs)).jobs;
  }

  /** Alias for removeJob retained for callers that prefer BullMQ-like naming. */
  remove(queueName: string, id: string): Promise<boolean> {
    return this.removeJob(queueName, id);
  }

  /** Alias for retryJob retained for callers that prefer BullMQ-like naming. */
  retry(queueName: string, id: string): Promise<boolean> {
    return this.retryJob(queueName, id);
  }
}
