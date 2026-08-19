import type { BulkJobOptions, JobsOptions } from 'bullmq';

/** Keeps only BullMQ job options supported by this module API. */
export function filterJobOptions<T extends JobsOptions | BulkJobOptions | undefined>(
  opts: T,
): T | undefined {
  if (!opts) return undefined;

  const allowed = [
    'attempts',
    'backoff',
    'delay',
    'priority',
    'removeOnComplete',
    'removeOnFail',
    'jobId',
    'lifo',
    'timeout',
    'stackTraceLimit',
  ] as const;
  const out: Record<string, unknown> = {};
  const source = opts as Record<string, unknown>;

  for (const key of allowed) {
    const value = source[key];
    if (value !== undefined) out[key] = value;
  }

  return Object.keys(out).length > 0 ? (out as T) : undefined;
}
