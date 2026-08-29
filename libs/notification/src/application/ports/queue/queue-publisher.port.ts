import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';

/** Injection token for the {@link QueuePublisherPort} port. */
export const QUEUE_PUBLISHER = Symbol('QUEUE_PUBLISHER');

/** Input required to publish a single delivery job to its channel queue. */
export interface PublishDeliveryJobInput {
  deliveryId: string;
  channel: NotificationChannel;
}

export interface QueuePublisherPort {
  publishDelivery(input: PublishDeliveryJobInput): Promise<void>;
}
