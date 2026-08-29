/**
 * Deterministic, configurable exponential retry policy for outbox publishing.
 *
 * The delay for the next retry after the `attempt`-th publish attempt is
 * `baseDelayMs * 2^(attempt - 1)`, optionally capped at `maxDelayMs`.
 */
export interface RetryPolicyConfig {
  /** Delay before the first retry (attempt 1). */
  baseDelayMs: number;
  /** Optional upper bound on the computed delay. */
  maxDelayMs?: number;
}

export interface RetryPolicy {
  /**
   * Returns the delay before the next retry given the 1-based attempt count
   * (i.e. `publish_attempts` after the current attempt was counted).
   */
  nextRetryDelayMs(attempt: number): number;
}

/** Injection token for the {@link RetryPolicy} implementation. */
export const RETRY_POLICY = Symbol('RETRY_POLICY');

/** Injection token for the {@link RetryPolicyConfig} value. */
export const RETRY_POLICY_CONFIG = Symbol('RETRY_POLICY_CONFIG');

export class ExponentialRetryPolicy implements RetryPolicy {
  constructor(private readonly config: RetryPolicyConfig) {}

  nextRetryDelayMs(attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    const delay = this.config.baseDelayMs * Math.pow(2, exponent);
    if (this.config.maxDelayMs !== undefined) {
      return Math.min(delay, this.config.maxDelayMs);
    }
    return delay;
  }
}
