# NestJS BullMQ Demo

Monorepo with `apps/demo` (producer HTTP API) and `libs/bullmq` (reusable BullMQ module). The API registers queues only; workers are started only by `worker.main.ts`. These unauthenticated endpoints are local/demo-only and must not be exposed publicly.

## Run

```bash
npm install
npm run build
docker compose up redis -d
npm run start:demo
npm run start:worker
```

## Routes

- `GET /health`
- `GET /live` for liveness
- `GET /ready` for Redis-aware readiness with bounded timeout
- `POST /jobs/normal` body `{"message":"hello"}`
- `POST /jobs/bulk` body `{"chunkSize":100,"jobs":[{"message":"a"},{"message":"b"}]}`; `QueueService.enqueueBulk` chunks into independent BullMQ `addBulk` calls, never per-job adds. Empty arrays return accepted `0`. If a later chunk fails, earlier chunks remain accepted; response is only returned when all chunks succeed.
- `POST /jobs/delayed` body `{"message":"later","delayMs":5000}`
- `POST /jobs/retry-deterministic` body `{"message":"retry","failUntilAttempt":1,"attempts":3,"backoffType":"fixed","backoffDelayMs":100}` or `{"message":"retry","failUntilAttempt":1,"attempts":3,"backoffType":"exponential","backoffDelayMs":100}`. BullMQ `attemptsMade` is zero on the first execution; this fails while `attemptsMade < failUntilAttempt` and then retries using the selected BullMQ backoff.
- `POST /jobs/priority` body `{"message":"important","priority":1}`. Lower numeric priority means higher BullMQ priority; waiting FIFO order is still affected by worker availability.
- `POST /jobs/load` body `{"count":10000,"chunkSize":250,"deterministicFailures":true}`
- `GET /jobs/stats`
- `GET /jobs/:id`
- `DELETE /jobs/:id`
- `POST /jobs/:id/retry`

Examples:

```bash
curl -s localhost:3000/health
curl -s -X POST localhost:3000/jobs/normal -H "content-type: application/json" -d '{"message":"hi"}'
curl -s -X POST localhost:3000/jobs/retry-deterministic -H "content-type: application/json" -d '{"message":"fixed retry","failUntilAttempt":1,"attempts":3,"backoffType":"fixed","backoffDelayMs":100}'
curl -s -X POST localhost:3000/jobs/retry-deterministic -H "content-type: application/json" -d '{"message":"exponential retry","failUntilAttempt":1,"attempts":3,"backoffType":"exponential","backoffDelayMs":100}'
curl -s localhost:3000/jobs/stats
```

Manual checklist: enqueue normal, bulk 10,000 with chunks, delayed, deterministic retry with fixed backoff, deterministic retry with exponential backoff, priority jobs queued before worker start, load, stats, get job, remove/retry admin routes.

## Operational notes

- Redis uses `maxRetriesPerRequest: null`, required by BullMQ workers.
- `WORKER_ID` defaults to `HOSTNAME` then PID, so Docker/Kubernetes replicas get distinct logs.
- Shutdown is coordinated by `BullMqLifecycleService`: workers are closed before queues in the same Nest context. `worker.close()` waits for active jobs, but pod/process grace periods can still interrupt work. BullMQ delivery is at-least-once; processors should be idempotent.
- Stats use BullMQ counts plus a single `getJobs(['waiting'], 0, 0, true)` peek for oldest waiting age; no full queue scan.
- BullMQ v5 worker `limiter` is a global rate limiter for workers processing a queue, not per worker process.
- Priority is non-preemptive: lower numeric priority is processed first among waiting jobs, but it does not interrupt active jobs and can be affected by available workers.
- Docker Redis uses AOF `appendfsync everysec`, so a crash can lose roughly the last second of writes.
- This demo is intentionally producer/worker only; no extra business domain is implemented.

## Docker and Kubernetes

```bash
docker build -t micro-app:latest .
docker compose config
docker compose up --build --scale worker=3
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/redis/
kubectl apply -f k8s/demo-api/
kubectl apply -f k8s/demo-worker/
```

Kubernetes manifests use a `ClusterIP` API service (not public exposure). Do not apply `k8s/secret.example.yaml` in the baseline demo; it is only an example for future Redis auth. The demo Redis manifest runs without password auth for internal local-demo use.

## Tests

```bash
npm run lint
npm run test:unit
RUN_INTEGRATION_TESTS=true TEST_REDIS_DB=15 npm run test:integration
```

Integration tests skip unless `RUN_INTEGRATION_TESTS=true` and require reachable Redis via `TEST_REDIS_*` or `REDIS_*`.
