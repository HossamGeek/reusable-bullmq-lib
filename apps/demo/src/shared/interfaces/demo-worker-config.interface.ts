export interface DemoWorkerConfig {
  id: string;
  concurrency: number;
  limiterMax: number;
  limiterDurationMs: number;
}
