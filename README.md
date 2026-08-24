## Reusable `@app/bullmq` library

`@app/bullmq` is the shared BullMQ infrastructure library for this monorepo. It owns generic queue setup, queue access, monitoring, workers, and shutdown behavior only; keep application/domain job names, payload contracts, and handler logic in the consuming app.

High-level structure under `libs/bullmq/src`:

- `bullmq.module.ts` - dynamic Nest module entry point.
- `services/queue` - `QueueService` producer/admin facade.
- `services/queue-registry` - creates and stores registered BullMQ `Queue` instances.
- `services/monitoring` - lightweight queue statistics.
- `services/worker-manager` - creates and tracks BullMQ `Worker` instances.
- `services/lifecycle` - closes workers and queues on Nest shutdown.
- `shared` - public interfaces, DI tokens, and helpers.

Always import public APIs from the package root:

```ts
import { BullMqModule, QueueService, type QueueDefinition } from '@app/bullmq';
```

### Configure the module and queues

`BullMqModule.forRoot(options, queues?, workers?)` accepts `BullMqRootOptions`, an optional `QueueDefinition[]`, and an optional `WorkerDefinition[]`:

```ts
import { Module } from '@nestjs/common';
import { BullMqModule, type QueueDefinition } from '@app/bullmq';

const queues: QueueDefinition[] = [
  {
    name: 'email',
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1_000 } },
    options: { limiter: { max: 100, duration: 60_000 } },
  },
];

@Module({
  imports: [
    BullMqModule.forRoot(
      {
        connection: { host: 'localhost', port: 6379 },
        queuePrefix: 'micro-app',
        defaultJobOptions: { removeOnComplete: true },
      },
      queues,
    ),
  ],
})
export class AppModule {}
```

`forRootAsync` accepts one options object with `imports`, `inject`, `useFactory`, plus optional `queues` and `workers`:

```ts
BullMqModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: { host: config.getOrThrow('REDIS_HOST'), port: 6379 },
    queuePrefix: 'micro-app',
  }),
  queues,
});
```

Queue definitions use `name`, optional BullMQ `QueueOptions` except `connection`/`prefix`, and optional `defaultJobOptions`. The library injects `connection`, `prefix`, and merges root and queue defaults.

### Produce and inspect jobs with `QueueService`

Normal consumers should prefer `QueueService` over direct BullMQ queue access:

```ts
import { Injectable } from '@nestjs/common';
import { QueueService, type QueueBulkJobInput } from '@app/bullmq';

@Injectable()
export class EmailProducer {
  constructor(private readonly queues: QueueService) {}

  async sendWelcome(userId: string) {
    return this.queues.enqueue('email', 'welcome', { userId }, { priority: 5 });
  }

  async sendDigestBatch(userIds: string[]) {
    const jobs: Array<QueueBulkJobInput<{ userId: string }>> = userIds.map((userId) => ({
      name: 'digest',
      data: { userId },
      opts: { attempts: 2 },
    }));

    return this.queues.enqueueBulk('email', jobs, 500); // chunkSize defaults to 100
  }

  scheduleReminder(userId: string) {
    return this.queues.enqueueDelayed('email', 'reminder', { userId }, 60_000);
  }

  getJob(id: string) {
    return this.queues.getJob('email', id);
  }

  removeJob(id: string) {
    return this.queues.removeJob('email', id);
  }

  retryJob(id: string) {
    return this.queues.retryJob('email', id);
  }

  stats() {
    return this.queues.getStats('email');
  }
}
```

Accepted job options are filtered to the supported BullMQ fields: `attempts`, `backoff`, `delay`, `priority`, `removeOnComplete`, `removeOnFail`, `jobId`, `lifo`, `timeout`, and `stackTraceLimit`.

### Configure workers

Workers are registered through `WorkerDefinition[]` passed to `forRoot`/`forRootAsync`. Put workers in a worker-only Nest process (not in every HTTP/API process), and run multiple replicas when you want distributed concurrency; each replica creates its own BullMQ workers.

```ts
import { Module } from '@nestjs/common';
import { Job } from 'bullmq';
import { BullMqModule, type WorkerDefinition } from '@app/bullmq';

type EmailPayload = { userId: string };

const workers: WorkerDefinition<EmailPayload>[] = [
  {
    queueName: 'email',
    processor: async (job: Job<EmailPayload>) => {
      // call app/domain services here
      return { sent: true, userId: job.data.userId };
    },
    options: { concurrency: 10, limiter: { max: 50, duration: 1_000 } },
  },
];

@Module({
  imports: [BullMqModule.forRoot({ connection: { host: 'localhost', port: 6379 } }, [], workers)],
})
export class WorkerModule {}
```

`WorkerManagerService` registers configured workers on module init and can also register additional `WorkerDefinition`s programmatically. `QueueRegistryService` registers/lists/closes queues, and `QueueMonitoringService` returns counts plus oldest waiting job age; use them directly only for infrastructure-level needs.

### Shutdown and behavior notes

- Call `app.enableShutdownHooks()` during bootstrap so `BullMqLifecycleService` closes workers before queues on process shutdown.
- Each Nest application context owns the queues/workers it creates; do not share instances across processes.
- BullMQ priority affects waiting order but does not preempt already active jobs.
- `enqueueBulk` chunks calls to BullMQ, but each job remains independent after enqueue.
- Retries are at-least-once; make handlers idempotent and safe for duplicate execution.
- BullMQ limiter options throttle starts per worker/queue according to BullMQ semantics; they are not a global business quota unless configured/deployed accordingly.

## Workspace migrations

Each migration-owning library keeps its TypeORM migrations and their registration isolated inside its own persistence layer (e.g. `libs/notification/src/infrastructure/persistence/typeorm/migrations`) and exports a standalone `createMigrationsDataSource()` factory. The generic CLI in `scripts/migrations.cli.ts` runs them through the registry in `scripts/migrations.registry.ts`:

```bash
npm run migration:run -- notification     # apply pending migrations
npm run migration:revert -- notification  # revert the last applied migration
npm run migration:show -- notification    # list executed/pending migrations
```

To add another migration-owning library, export `createMigrationsDataSource()` from the library's migrations barrel and add one entry to `migrationModules`; no extra package scripts are required.
