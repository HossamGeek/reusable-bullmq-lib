import { CommandBus } from '@nestjs/cqrs';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { RecipientType } from '../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../domain/enums/reference-type.enum';
import { CreateNotificationCommand } from '../commands/create-notification.command';
import { NotificationInput } from '../dto/notification-input.dto';
import { PreparedNotification } from '../dto/prepared-notification.dto';
import { NotificationApplicationService } from './notification-application.service';
import { NotificationRequestPreparation } from './notification-request-preparation.service';

describe('NotificationApplicationService', () => {
  const input: NotificationInput<NotificationType.ORDER_CREATED> = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    channels: [NotificationChannel.EMAIL],
  };

  const prepared: PreparedNotification<NotificationType.ORDER_CREATED> = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    channels: [NotificationChannel.EMAIL],
    destinations: { email: 'client@example.com' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    context: { orderId: '1001', orderNumber: 'ORD-1001', clientId: '42' },
  };

  let prepare: jest.Mock<Promise<PreparedNotification>, [NotificationInput]>;
  let execute: jest.Mock<Promise<void>, [CreateNotificationCommand]>;
  let service: NotificationApplicationService;

  beforeEach(() => {
    prepare = jest
      .fn<Promise<PreparedNotification>, [NotificationInput]>()
      .mockResolvedValue(prepared);
    execute = jest.fn<Promise<void>, [CreateNotificationCommand]>().mockResolvedValue(undefined);
    service = new NotificationApplicationService(
      { prepare } as unknown as NotificationRequestPreparation,
      { execute } as unknown as CommandBus,
    );
  });

  it('prepares the input then dispatches exactly one CreateNotificationCommand', async () => {
    await expect(service.create(input)).resolves.toBeUndefined();

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(input);
    expect(execute).toHaveBeenCalledTimes(1);

    const command = execute.mock.calls[0][0];
    expect(command).toBeInstanceOf(CreateNotificationCommand);
    expect(command.prepared).toBe(prepared);
    // The command carries no separate channels field; channels live on prepared.
    expect('channels' in command).toBe(false);
  });

  it('propagates preparation failures without dispatching', async () => {
    const failure = new Error('preparation failed');
    prepare.mockRejectedValue(failure);

    await expect(service.create(input)).rejects.toBe(failure);
    expect(execute).not.toHaveBeenCalled();
  });

  it('propagates CommandBus failures untouched', async () => {
    const failure = new Error('handler failed');
    execute.mockRejectedValue(failure);

    await expect(service.create(input)).rejects.toBe(failure);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});