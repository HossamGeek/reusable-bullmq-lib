export interface DemoJobData {
  message?: string;
  payload?: Record<string, unknown>;
  failUntilAttempt?: number;
  enqueuedAt: number;
  workerId?: string;
  sequence?: number;
}
