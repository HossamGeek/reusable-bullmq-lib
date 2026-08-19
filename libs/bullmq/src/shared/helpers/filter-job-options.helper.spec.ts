import { filterJobOptions } from './filter-job-options.helper';

describe('filterJobOptions', () => {
  it('returns undefined for undefined input and for only unsupported options', () => {
    expect(filterJobOptions(undefined)).toBeUndefined();
    expect(
      filterJobOptions({ repeat: { every: 1 }, debounce: { id: 'x' } } as any),
    ).toBeUndefined();
  });

  it('keeps all supported options and drops supported undefined values', () => {
    expect(
      filterJobOptions({
        attempts: 2,
        backoff: { type: 'fixed', delay: 1 },
        delay: 5,
        priority: 1,
        removeOnComplete: 1,
        removeOnFail: 2,
        jobId: 'a',
        lifo: true,
        timeout: 9,
        stackTraceLimit: 3,
        repeat: { every: 1 },
        debounce: undefined,
      } as any),
    ).toEqual({
      attempts: 2,
      backoff: { type: 'fixed', delay: 1 },
      delay: 5,
      priority: 1,
      removeOnComplete: 1,
      removeOnFail: 2,
      jobId: 'a',
      lifo: true,
      timeout: 9,
      stackTraceLimit: 3,
    });
  });

  it('retains valid falsy values', () => {
    expect(
      filterJobOptions({
        attempts: 0,
        delay: 0,
        priority: 0,
        removeOnComplete: false,
        removeOnFail: false,
        jobId: '',
        lifo: false,
        timeout: 0,
        stackTraceLimit: 0,
      } as any),
    ).toEqual({
      attempts: 0,
      delay: 0,
      priority: 0,
      removeOnComplete: false,
      removeOnFail: false,
      jobId: '',
      lifo: false,
      timeout: 0,
      stackTraceLimit: 0,
    });
  });
});
