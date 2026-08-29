import { Injectable } from '@nestjs/common';
import { QueueService } from '@app/bullmq';
import {
  PublishDeliveryJobInput,
  QueuePublisherPort,
} from '../../../application/ports/queue/queue-publisher.port';
import {
  NOTIFICATION_DELIVERY_JOB_NAME,
  NOTIFICATION_QUEUE_NAMES,
} from './notification-delivery.job.helper';
import { NotificationChannel } from '@app/notification/domain/enums';

@Injectable()
export class NotificationQueuePublisher implements QueuePublisherPort {
  constructor(
    private readonly queueService: QueueService,
  ) {}

  async publishDelivery(input: PublishDeliveryJobInput): Promise<void> {
    const queueName = this.resolveQueueName(input.channel);

    await this.queueService.enqueue(
      queueName,
      NOTIFICATION_DELIVERY_JOB_NAME,
      { deliveryId: input.deliveryId },
      { jobId: this.createNotificationJobId(input.deliveryId, NOTIFICATION_DELIVERY_JOB_NAME) },
    );
  }

  private resolveQueueName(channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return NOTIFICATION_QUEUE_NAMES.EMAIL;
      case NotificationChannel.WHATSAPP:
        return NOTIFICATION_QUEUE_NAMES.WHATSAPP;
      default:
        throw new Error(`Unsupported notification channel: ${String(channel)}`);
    }
  }

  private createNotificationJobId(jobId: string, jobName: string): string {
    return `${jobName}-${jobId}`;
  }
}
