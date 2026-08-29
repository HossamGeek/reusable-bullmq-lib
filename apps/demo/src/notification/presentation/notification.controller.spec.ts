import {
  CreateNotificationDto,
  NotificationApplicationService,
  NotificationChannel,
  NotificationType,
  RecipientType,
  ReferenceType,
} from '@app/notification';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  const dto: CreateNotificationDto = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    channels: [NotificationChannel.EMAIL],
  };

  let create: jest.Mock<Promise<void>, Parameters<NotificationApplicationService['create']>>;
  let controller: NotificationController;

  beforeEach(() => {
    create = jest
      .fn<Promise<void>, Parameters<NotificationApplicationService['create']>>()
      .mockResolvedValue(undefined);
    controller = new NotificationController({
      create,
    } as unknown as NotificationApplicationService);
  });

  it('maps the DTO to a NotificationInput and delegates to the application service', async () => {
    await expect(controller.create(dto)).resolves.toEqual({ accepted: true });

    expect(create).toHaveBeenCalledTimes(1);
    const input = create.mock.calls[0][0];
    expect(input).toEqual({
      sourceEventId: 'evt-1',
      type: NotificationType.ORDER_CREATED,
      recipient: { type: RecipientType.CLIENT, id: '42' },
      reference: { type: ReferenceType.ORDER, id: '1001' },
      channels: [NotificationChannel.EMAIL],
    });
  });

  it('propagates application service failures untouched', async () => {
    const failure = new Error('workflow failed');
    create.mockRejectedValue(failure);

    await expect(controller.create(dto)).rejects.toBe(failure);
  });
});
