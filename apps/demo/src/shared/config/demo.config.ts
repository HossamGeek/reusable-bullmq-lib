import { registerAs } from '@nestjs/config';
import { parseIntEnv, optionalString } from './parsing';
export const demoConfig = registerAs('demo', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseIntEnv(process.env.PORT, 3000, 1),
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseIntEnv(process.env.REDIS_PORT, 6379, 1),
    db: parseIntEnv(process.env.REDIS_DB, 0, 0),
    username: optionalString(process.env.REDIS_USERNAME),
    password: optionalString(process.env.REDIS_PASSWORD),
    maxRetriesPerRequest: null,
  },
  queuePrefix: process.env.QUEUE_PREFIX ?? 'demo',
  defaultJobAttempts: parseIntEnv(process.env.DEFAULT_JOB_ATTEMPTS, 3, 1),
  removeOnComplete: parseIntEnv(process.env.DEFAULT_REMOVE_ON_COMPLETE, 1000, 0),
  removeOnFail: parseIntEnv(process.env.DEFAULT_REMOVE_ON_FAIL, 1000, 0),
  worker: {
    id:
      optionalString(process.env.WORKER_ID) ??
      optionalString(process.env.HOSTNAME) ??
      `worker-${process.pid}`,
    concurrency: parseIntEnv(process.env.WORKER_CONCURRENCY, 5, 1),
    limiterMax: parseIntEnv(process.env.WORKER_LIMITER_MAX, 100, 1),
    limiterDurationMs: parseIntEnv(process.env.WORKER_LIMITER_DURATION_MS, 1000, 1),
  },
}));
