/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
const close = jest.fn().mockResolvedValue(undefined);
const queueConstructor = jest.fn(function (this: any, name: string, options: any) {
  this.name = name;
  this.qualifiedName = `${options.prefix ?? 'bull'}:${name}`;
  this.close = close;
});

jest.mock('bullmq', () => ({ Queue: queueConstructor }));

import { QueueRegistryService } from './queue-registry.service';

describe('QueueRegistryService', () => {
  const options = {
    connection: { host: 'localhost', port: 6379, maxRetriesPerRequest: null },
    queuePrefix: 'p',
    defaultJobOptions: { attempts: 1, removeOnComplete: true },
  };

  beforeEach(() => {
    close.mockClear();
    queueConstructor.mockClear();
  });

  it('constructs queues from definitions and accepts empty definitions without side effects', () => {
    const registry = new QueueRegistryService(options, [
      { name: 'a' },
      { name: 'b', options: { prefix: 'ignored' } as any },
    ]);

    expect(queueConstructor).toHaveBeenCalledTimes(2);
    expect(queueConstructor).toHaveBeenNthCalledWith(1, 'a', {
      connection: options.connection,
      prefix: 'p',
      defaultJobOptions: options.defaultJobOptions,
    });
    expect(registry.list()).toEqual([
      { name: 'a', qualifiedName: 'p:a' },
      { name: 'b', qualifiedName: 'p:b' },
    ]);

    queueConstructor.mockClear();
    expect(new QueueRegistryService(options, []).list()).toEqual([]);
    expect(new QueueRegistryService(options, undefined as any).list()).toEqual([]);
    expect(queueConstructor).not.toHaveBeenCalled();
  });

  it('normalizes options with root connection/prefix and defaultJobOptions merge precedence', () => {
    new QueueRegistryService(options, [
      {
        name: 'q',
        options: {
          defaultJobOptions: { attempts: 2, delay: 5 },
          connection: { host: 'ignored' },
          prefix: 'ignored',
        } as any,
        defaultJobOptions: { delay: 9, priority: 1 },
      },
    ]);

    expect(queueConstructor).toHaveBeenCalledWith('q', {
      connection: options.connection,
      prefix: 'p',
      defaultJobOptions: { attempts: 2, removeOnComplete: true, delay: 9, priority: 1 },
    });
  });

  it('reuses identical reordered registrations and rejects conflicts', () => {
    const registry = new QueueRegistryService(options, []);
    const first = registry.register({
      name: 'q',
      options: { defaultJobOptions: { backoff: { delay: 1, type: 'fixed' }, attempts: 2 } },
    });
    const second = registry.register({
      name: 'q',
      options: { defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 1 } } },
    });

    expect(second).toBe(first);
    expect(queueConstructor).toHaveBeenCalledTimes(1);
    expect(() => registry.register({ name: 'q', defaultJobOptions: { attempts: 9 } })).toThrow(
      /different options/,
    );
  });

  it('rejects invalid runtime names', () => {
    const registry = new QueueRegistryService(options, []);

    for (const name of [undefined, null, 1, '', '   ']) {
      expect(() => registry.register({ name } as any)).toThrow(/requires/);
    }
  });

  it('gets queues, errors on missing, lists empty/multiple qualified names', () => {
    const registry = new QueueRegistryService(options, []);
    expect(registry.list()).toEqual([]);
    const q1 = registry.register({ name: 'one' });
    registry.register({ name: 'two' });

    expect(registry.get('one')).toBe(q1);
    expect(() => registry.get('missing')).toThrow("Queue 'missing' is not registered");
    expect(registry.list()).toEqual([
      { name: 'one', qualifiedName: 'p:one' },
      { name: 'two', qualifiedName: 'p:two' },
    ]);
  });

  it('closes all registered queues, supports empty and repeated calls, propagates close errors, and keeps one instance for reused queue', async () => {
    await expect(new QueueRegistryService(options, []).closeAll()).resolves.toBeUndefined();
    expect(close).not.toHaveBeenCalled();

    const registry = new QueueRegistryService(options, []);
    registry.register({ name: 'one' });
    registry.register({ name: 'one' });
    registry.register({ name: 'two' });
    await registry.closeAll();
    await registry.closeAll();
    expect(close).toHaveBeenCalledTimes(4);

    close.mockRejectedValueOnce(new Error('close error'));
    await expect(registry.closeAll()).rejects.toThrow('close error');
  });

  it('propagates constructor registration errors', () => {
    expect(() => new QueueRegistryService(options, [{ name: '' }])).toThrow(/requires/);
  });
});
