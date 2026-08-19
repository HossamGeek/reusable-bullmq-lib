import { QueueRegistryService } from '../queue-registry/queue-registry.service';
import { WorkerManagerService } from '../worker-manager/worker-manager.service';
import { BullMqLifecycleService } from './bullmq-lifecycle.service';

describe('BullMqLifecycleService', () => {
  const service = (workerClose: jest.Mock, queueClose: jest.Mock) =>
    new BullMqLifecycleService(
      { closeAll: workerClose } as unknown as WorkerManagerService,
      { closeAll: queueClose } as unknown as QueueRegistryService,
    );

  it('awaits workers before queues on success and repeated shutdown repeats closes', async () => {
    const order: string[] = [];
    const workers = jest.fn(() => {
      order.push('workers');
      return Promise.resolve();
    });
    const queues = jest.fn(() => {
      order.push('queues');
      return Promise.resolve();
    });
    const lifecycle = service(workers, queues);

    await lifecycle.onApplicationShutdown();
    await lifecycle.onApplicationShutdown();

    expect(order).toEqual(['workers', 'queues', 'workers', 'queues']);
    expect(workers).toHaveBeenCalledTimes(2);
    expect(queues).toHaveBeenCalledTimes(2);
  });

  it('does not close queues when worker close rejects', async () => {
    const workers = jest.fn().mockRejectedValue(new Error('workers failed'));
    const queues = jest.fn().mockResolvedValue(undefined);

    await expect(service(workers, queues).onApplicationShutdown()).rejects.toThrow(
      'workers failed',
    );
    expect(queues).not.toHaveBeenCalled();
  });

  it('propagates queue close rejection after workers close', async () => {
    const workers = jest.fn().mockResolvedValue(undefined);
    const queues = jest.fn().mockRejectedValue(new Error('queues failed'));

    await expect(service(workers, queues).onApplicationShutdown()).rejects.toThrow('queues failed');
    expect(workers).toHaveBeenCalledTimes(1);
    expect(queues).toHaveBeenCalledTimes(1);
  });
});
