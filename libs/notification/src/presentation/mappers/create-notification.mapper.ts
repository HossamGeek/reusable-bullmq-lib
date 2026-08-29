import { NotificationInput } from '../../application/dto/notification-input.dto';
import { CreateNotificationDto } from '../dto/create-notification.dto';
export class CreateNotificationMapper {
  static toInput(dto: CreateNotificationDto): NotificationInput {
    return {
      sourceEventId: dto.sourceEventId,
      type: dto.type,
      recipient: {
        type: dto.recipient.type,
        id: dto.recipient.id,
      },
      reference: {
        type: dto.reference.type,
        id: dto.reference.id,
      },
      channels: [...dto.channels],
    };
  }
}