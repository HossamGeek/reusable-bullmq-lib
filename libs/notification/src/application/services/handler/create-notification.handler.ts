import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Notification } from '../../../domain/entities/notification.entity';
import { NotificationDelivery } from '../../../domain/entities/notification-delivery.entity';
import { NotificationChannel } from '../../../domain/enums/notification-channel.enum';
import { NotificationReference } from '../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../domain/value-objects/recipient.value-object';
import { CreateNotificationCommand } from '../../commands/create-notification.command';
import { PreparedDestinations } from '../../dto/prepared-notification.dto';
import { DuplicateNotificationError, MissingDestinationError } from '../../errors';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../ports/persistence/notification-repository.port';
import { NOTIFICATION_TRANSACTION, NotificationTransaction } from '../../ports/persistence/notification-transaction.port';

@Injectable()
@CommandHandler(CreateNotificationCommand)
export class CreateNotificationHandler
  implements ICommandHandler<CreateNotificationCommand, void>
{
  constructor(
    @Inject(NOTIFICATION_TRANSACTION) private readonly notificationTransaction: NotificationTransaction,
    @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<void> {
    const { prepared } = command;

    // Resolve every snapshot address up front so a commanded channel without
    // a destination fails before any write happens.
    const planned: Array<{ channel: NotificationChannel; address: string }> = [];
    for (const channel of prepared.channels) {
      const address = this.addressFor(channel, prepared.destinations);
      if (!address) {
        throw new MissingDestinationError(channel);
      }
      planned.push({ channel, address });
    }

    // Check for a duplicate notification.
    const existing = await this.notificationRepository.findBySourceEventRecipientAndType({
      sourceEventId: prepared.sourceEventId,
      recipientType: prepared.recipient.type,
      recipientId: prepared.recipient.id,
      type: prepared.type,
    });
    if (existing) {
      return;
    }

    try {
      await this.notificationTransaction.run(async ({ notifications, deliveries, outbox }) => {
        const saved = await notifications.save(
          Notification.create({
            sourceEventId: prepared.sourceEventId,
            recipient: Recipient.create(prepared.recipient.type, prepared.recipient.id),
            type: prepared.type,
            reference: NotificationReference.create(
              prepared.reference.type,
              prepared.reference.id,
            ),
            context: prepared.context,
          }),
        );
        const notificationId = saved.id;
        if (!notificationId) {
          throw new Error('Notification save returned no id.');
        }

        for (const { channel, address } of planned) {
          const delivery = await deliveries.save(
            NotificationDelivery.create({
              notificationId,
              channel,
              recipientAddress: address,
            }),
          );
          const deliveryId = delivery.id;
          if (!deliveryId) {
            throw new Error('Delivery save returned no id.');
          }
          await outbox.save({
            id: null,
            deliveryId,
            channel,
            publishedAt: null,
            publishAttempts: 0,
            lastPublishError: null,
            nextPublishAt: null,
            createdAt: null,
          });
        }
      });
    } catch (error) {
      if (error instanceof DuplicateNotificationError) {
        return;
      }
      throw error;
    }
  }

  private addressFor(
    channel: NotificationChannel,
    destinations: PreparedDestinations,
  ): string | undefined {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return destinations.email;
      case NotificationChannel.WHATSAPP:
        return destinations.whatsapp;
      default:
        return undefined;
    }
  }
}