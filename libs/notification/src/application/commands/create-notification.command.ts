import { NotificationType } from '../../domain/enums/notification-type.enum';
import { PreparedNotification } from '../dto/prepared-notification.dto';
export class CreateNotificationCommand<T extends NotificationType = NotificationType> {
  constructor(readonly prepared: PreparedNotification<T>) {}
}