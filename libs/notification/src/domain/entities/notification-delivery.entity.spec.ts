import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../enums/notification-delivery-status.enum';
import { RecipientType } from '../enums/recipient-type.enum';
import { Recipient } from '../value-objects/recipient.value-object';
import { NotificationDelivery } from './notification-delivery.entity';

describe('NotificationDelivery', () => {
  it('creates pending deliveries with a zeroed attempt counter', () => {
    const delivery = NotificationDelivery.create({
      notificationId: '7',
      channel: NotificationChannel.EMAIL,
      recipientAddress: 'client@example.com',
    });

    expect(delivery.id).toBeNull();
    expect(delivery.status).toBe(NotificationDeliveryStatus.PENDING);
    expect(delivery.attemptCount).toBe(0);
    expect(delivery.providerMessageId).toBeNull();
    expect(delivery.lastError).toBeNull();
    expect(delivery.sentAt).toBeNull();
  });

  it('snapshots the channel address given at creation time', () => {
    // The recipient's current contact data lives on the Recipient value
    // object; the delivery must keep the address it was created with and
    // never re-resolve it.
    const recipient = Recipient.create(RecipientType.CLIENT, '42', 'new-address@example.com');
    const delivery = NotificationDelivery.create({
      notificationId: '7',
      channel: NotificationChannel.WHATSAPP,
      recipientAddress: '+966500000000',
    });

    expect(recipient.address).toBe('new-address@example.com');
    expect(delivery.recipientAddress).toBe('+966500000000');
  });

  it('rejects deliveries without a notification or address', () => {
    expect(() =>
      NotificationDelivery.create({
        notificationId: '',
        channel: NotificationChannel.EMAIL,
        recipientAddress: 'client@example.com',
      }),
    ).toThrow(/notificationId is required/);

    expect(() =>
      NotificationDelivery.create({
        notificationId: '7',
        channel: NotificationChannel.EMAIL,
        recipientAddress: ' ',
      }),
    ).toThrow(/recipientAddress is required/);
  });
});
