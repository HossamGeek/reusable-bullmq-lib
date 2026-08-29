import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { RecipientType } from '../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../domain/enums/reference-type.enum';
import { PreparedNotification } from '../dto/prepared-notification.dto';
import { CreateNotificationCommand } from './create-notification.command';

describe('CreateNotificationCommand', () => {
  const prepared: PreparedNotification<NotificationType.ORDER_CREATED> = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    channels: [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
    destinations: { email: 'client@example.com', whatsapp: '+966500000000' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    context: { orderId: '1001', orderNumber: 'ORD-1001', clientId: '42' },
  };

  it('carries only the flattened prepared notification', () => {
    const command = new CreateNotificationCommand(prepared);

    expect(command.prepared).toBe(prepared);
    // Channels are not a separate command field; they live on prepared.
    expect('channels' in command).toBe(false);
  });
});