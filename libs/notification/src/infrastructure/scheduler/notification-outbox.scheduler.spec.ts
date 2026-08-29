import { Logger } from '@nestjs/common';
import { OutboxPublisher } from '../../application/services/outbox-publisher.service';
import { NotificationOutboxScheduler } from './notification-outbox.scheduler';

describe('NotificationOutboxScheduler', () => {
  const buildScheduler = (deps: {
    publisher: Pick<OutboxPublisher, 'run'>;
    intervalMs?: number;
  }) => {
    const scheduler = new NotificationOutboxScheduler(deps.publisher as OutboxPublisher, {
      intervalMs: deps.intervalMs ?? 5000,
    });
    return { scheduler };
  };

  it('invokes the outbox publisher on each tick', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    const { scheduler } = buildScheduler({ publisher: { run } });

    await scheduler.tick();
    await scheduler.tick();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('skips overlapping ticks while a previous run is still in flight', async () => {
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    let resolveRun: () => void = () => undefined;
    const run = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveRun = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const { scheduler } = buildScheduler({ publisher: { run } });

    const first = scheduler.tick();
    // Second tick while the first is still running must be skipped.
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);

    resolveRun();
    await first;

    // After the first completes, a new tick runs again.
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(2);
    debugSpy.mockRestore();
  });

  it('logs and swallows errors thrown by the publisher', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const run = jest.fn().mockRejectedValue(new Error('boom'));
    const { scheduler } = buildScheduler({ publisher: { run } });

    await expect(scheduler.tick()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    errorSpy.mockRestore();
  });

  it('starts and stops the interval timer on module lifecycle hooks', async () => {
    jest.useFakeTimers();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const run = jest.fn().mockResolvedValue(undefined);
    const { scheduler } = buildScheduler({ publisher: { run }, intervalMs: 1000 });

    scheduler.onModuleInit();
    // Fire the first interval and let the async tick complete before the next.
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);

    logSpy.mockRestore();
    jest.useRealTimers();
  });
});
