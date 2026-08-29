import { ExponentialRetryPolicy } from './retry-policy';

describe('ExponentialRetryPolicy', () => {
  it('returns the base delay for the first attempt', () => {
    const policy = new ExponentialRetryPolicy({ baseDelayMs: 1000 });
    expect(policy.nextRetryDelayMs(1)).toBe(1000);
  });

  it('doubles the delay on each subsequent attempt', () => {
    const policy = new ExponentialRetryPolicy({ baseDelayMs: 1000 });
    expect(policy.nextRetryDelayMs(2)).toBe(2000);
    expect(policy.nextRetryDelayMs(3)).toBe(4000);
    expect(policy.nextRetryDelayMs(4)).toBe(8000);
  });

  it('caps the delay at maxDelayMs when configured', () => {
    const policy = new ExponentialRetryPolicy({ baseDelayMs: 1000, maxDelayMs: 5000 });
    expect(policy.nextRetryDelayMs(1)).toBe(1000);
    expect(policy.nextRetryDelayMs(3)).toBe(4000);
    expect(policy.nextRetryDelayMs(4)).toBe(5000);
    expect(policy.nextRetryDelayMs(10)).toBe(5000);
  });

  it('is deterministic for the same attempt count', () => {
    const policy = new ExponentialRetryPolicy({ baseDelayMs: 250, maxDelayMs: 10000 });
    expect(policy.nextRetryDelayMs(5)).toBe(policy.nextRetryDelayMs(5));
  });
});
