import { QueueService } from '@app/bullmq';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import {
  NOTIFICATION_DELIVERY_JOB_NAME,
  NOTIFICATION_QUEUE_NAMES,
} from './notification-delivery.job.helper';
import { NotificationQueuePublisher } from './notification-queue.publisher';

describe('NotificationQueuePublisher', () => {
  const enqueue = jest.fn().mockResolvedValue({ id: '1', name: 'job', queueName: 'q' });
  const queueService = { enqueue } as unknown as QueueService;
  const publisher = new NotificationQueuePublisher(queueService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes a delivery job to the resolved queue with a stable job id', async () => {
    await publisher.publishDelivery({
      deliveryId: '42',
      channel: NotificationChannel.EMAIL,
    });

    expect(enqueue).toHaveBeenCalledWith(
      NOTIFICATION_QUEUE_NAMES.EMAIL,
      NOTIFICATION_DELIVERY_JOB_NAME,
      { deliveryId: '42' },
      { jobId: `${NOTIFICATION_DELIVERY_JOB_NAME}-42` },
    );
  });

  it('routes whatsapp deliveries to the whatsapp queue', async () => {
    await publisher.publishDelivery({
      deliveryId: '7',
      channel: NotificationChannel.WHATSAPP,
    });

    expect(enqueue).toHaveBeenCalledWith(
      NOTIFICATION_QUEUE_NAMES.WHATSAPP,
      NOTIFICATION_DELIVERY_JOB_NAME,
      { deliveryId: '7' },
      { jobId: `${NOTIFICATION_DELIVERY_JOB_NAME}-7` },
    );
  });

  it('propagates errors for unsupported channels without enqueuing', async () => {
    await expect(
      publisher.publishDelivery({ deliveryId: '1', channel: 'SMS' as NotificationChannel }),
    ).rejects.toThrow(/Unsupported notification channel/);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('propagates enqueue failures', async () => {
    enqueue.mockRejectedValueOnce(new Error('enqueue failed'));

    await expect(
      publisher.publishDelivery({ deliveryId: '1', channel: NotificationChannel.EMAIL }),
    ).rejects.toThrow('enqueue failed');
  });
});
