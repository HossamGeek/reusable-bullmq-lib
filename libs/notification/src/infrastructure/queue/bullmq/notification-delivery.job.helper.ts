export const NOTIFICATION_QUEUE_NAMES = {
  EMAIL: 'notification-email',
  WHATSAPP: 'notification-whatsapp',
} as const;

export const NOTIFICATION_DELIVERY_JOB_NAME = 'notification-delivery';

export interface NotificationDeliveryJob {
  deliveryId: string;
}
