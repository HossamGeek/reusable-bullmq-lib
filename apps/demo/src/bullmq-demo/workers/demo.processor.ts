import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { DemoJobData } from '../../shared/interfaces/demo-job-data.interface';

/** Creates the demo worker processor with deterministic retry behavior for examples. */
export function createDemoProcessor(workerId: string) {
  const logger = new Logger('DemoWorker');

  return async (job: Job<DemoJobData>) => {
    await Promise.resolve();

    const latencyMs = Date.now() - (job.data.enqueuedAt ?? job.timestamp);
    logger.log(
      `WORKER_ID=${workerId} job=${job.id} attemptsMade=${job.attemptsMade} latencyMs=${latencyMs}`,
    );

    const failUntil = job.data.failUntilAttempt ?? 0;
    if (job.attemptsMade < failUntil) {
      throw new Error(`deterministic failure until attempt ${failUntil}`);
    }

    return {
      workerId,
      latencyMs,
      processedAt: new Date().toISOString(),
      echo: job.data.message ?? null,
    };
  };
}
