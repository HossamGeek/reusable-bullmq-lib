import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { CreateNotificationCommand } from '../commands/create-notification.command';
import { NotificationInput } from '../dto/notification-input.dto';
import { NotificationRequestPreparation } from './notification-request-preparation.service';

/**
 * Application entry point of the notification creation workflow.
 */
@Injectable()
export class NotificationApplicationService {
  constructor(
    private readonly preparation: NotificationRequestPreparation,
    private readonly commandBus: CommandBus,
  ) {}

  async create<T extends NotificationType>(input: NotificationInput<T>): Promise<void> {
    const prepared = await this.preparation.prepare(input);
    return this.commandBus.execute(new CreateNotificationCommand(prepared));
  }
}