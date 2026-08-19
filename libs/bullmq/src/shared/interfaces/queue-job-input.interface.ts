import type { BulkJobOptions } from 'bullmq';

export interface QueueBulkJobInput<T> {
  name: string;
  data: T;
  opts?: BulkJobOptions;
}
