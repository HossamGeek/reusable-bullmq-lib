/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
const workerClose = jest.fn().mockResolvedValue(undefined);
const workerOn = jest.fn(function (this: any, event: string, handler: (...args: any[]) => void) {
  this.handlers[event] = handler;
  return this;
});
const workerConstructor = jest.fn(function (
  this: any,
  queueName: string,
  processor: any,
  options: any,
) {
  this.queueName = queueName;
  this.processor = processor;
  this.options = options;
  this.handlers = {};
  this.on = workerOn;
  this.close = workerClose;
});

jest.mock('bullmq', () => ({ Worker: workerConstructor }));

import { Logger } from '@nestjs/common';
import { WorkerManagerService } from './worker-manager.service';

describe('WorkerManagerService', () => {
  const options = { connection: { host: 'localhost' }, queuePrefix: 'p' };
  const processor = jest.fn();

  beforeEach(() => {
    workerConstructor.mockClear();
    workerOn.mockClear();
    workerClose.mockClear();
    processor.mockClear();
  });

  it('registers all definitions on module init and no-ops for empty definitions', () => {
    const manager = new WorkerManagerService(options, [
      { queueName: 'a', processor },
      { queueName: 'b', processor, options: { concurrency: 2 } },
    ] as any);

    manager.onModuleInit();

    expect(workerConstructor).toHaveBeenCalledTimes(2);
    expect(workerConstructor).toHaveBeenNthCalledWith(1, 'a', processor, {
      connection: options.connection,
      prefix: 'p',
    });
    expect(workerConstructor).toHaveBeenNthCalledWith(2, 'b', processor, {
      concurrency: 2,
      connection: options.connection,
      prefix: 'p',
    });

    workerConstructor.mockClear();
    new WorkerManagerService(options, []).onModuleInit();
    new WorkerManagerService(options, undefined as any).onModuleInit();
    expect(workerConstructor).not.toHaveBeenCalled();
  });

  it('registers one worker with root connection/prefix override, processor, event listeners, and logger handlers', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const manager = new WorkerManagerService(options, []);

    const worker = manager.registerWorker({
      queueName: 'q',
      processor,
      options: { connection: { host: 'ignored' }, prefix: 'ignored', concurrency: 3 } as any,
    }) as any;

    expect(workerConstructor).toHaveBeenCalledWith('q', processor, {
      connection: options.connection,
      prefix: 'p',
      concurrency: 3,
    });
    expect(workerOn).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(workerOn).toHaveBeenCalledWith('error', expect.any(Function));

    worker.handlers.failed({ id: 5 }, new Error('bad'));
    worker.handlers.failed(undefined, new Error('worse'));
    worker.handlers.error(new Error('boom'));
    expect(warn).toHaveBeenNthCalledWith(1, 'job failed queue=q id=5 reason=bad');
    expect(warn).toHaveBeenNthCalledWith(2, 'job failed queue=q id=unknown reason=worse');
    expect(error).toHaveBeenCalledWith('worker error queue=q: boom');

    warn.mockRestore();
    error.mockRestore();
  });

  it('closes all/empty workers, repeats according to implementation, propagates close errors, and constructor errors bubble', async () => {
    const empty = new WorkerManagerService(options, []);
    await expect(empty.closeAll()).resolves.toBeUndefined();
    expect(workerClose).not.toHaveBeenCalled();

    const manager = new WorkerManagerService(options, [
      { queueName: 'a', processor },
      { queueName: 'b', processor },
    ] as any);
    manager.onModuleInit();
    await manager.closeAll();
    await manager.closeAll();
    expect(workerClose).toHaveBeenCalledTimes(4);

    workerClose.mockRejectedValueOnce(new Error('close failed'));
    await expect(manager.closeAll()).rejects.toThrow('close failed');

    workerConstructor.mockImplementationOnce(() => {
      throw new Error('constructor failed');
    });
    expect(() =>
      new WorkerManagerService(options, [{ queueName: 'x', processor }] as any).onModuleInit(),
    ).toThrow('constructor failed');
  });
});
