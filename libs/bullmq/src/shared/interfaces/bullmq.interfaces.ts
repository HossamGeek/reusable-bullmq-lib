import type { ModuleMetadata } from '@nestjs/common';
import type { JobsOptions, Processor, QueueOptions, WorkerOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';

export interface BullMqRootOptions {
  connection: RedisOptions;
  defaultJobOptions?: JobsOptions;
  queuePrefix?: string;
}

export interface QueueDefinition {
  name: string;
  options?: Omit<QueueOptions, 'connection' | 'prefix'>;
  defaultJobOptions?: JobsOptions;
}

export interface WorkerDefinition<T = any> {
  queueName: string;
  processor: Processor<T, unknown, string>;
  options?: Omit<WorkerOptions, 'connection' | 'prefix'>;
}

export interface RegisteredQueueInfo {
  name: string;
  qualifiedName: string;
}

export interface EnqueueResult {
  id: string;
  name: string;
  queueName: string;
  state?: string;
}

export interface BulkEnqueueResult {
  accepted: number;
  chunks: number;
  jobs: EnqueueResult[];
}

export interface QueueStats {
  queueName: string;
  counts: Record<string, number>;
  oldestWaitingAgeMs: number | null;
  oldestWaitingJobId: string | null;
}

export interface BullMqModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => BullMqRootOptions | Promise<BullMqRootOptions>;
  queues?: QueueDefinition[];
  workers?: WorkerDefinition[];
}
