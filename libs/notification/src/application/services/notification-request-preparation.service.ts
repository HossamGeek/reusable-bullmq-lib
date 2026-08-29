import { Inject, Injectable } from '@nestjs/common';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { NotificationInput } from '../dto/notification-input.dto';
import {
  PreparedDestinations,
  PreparedNotification,
} from '../dto/prepared-notification.dto';
import {
  NOTIFICATION_CONTEXT_RESOLVER,
  NotificationContextResolver,
} from '../ports/resolution/notification-context-resolver.port';
import {
  RECIPIENT_DESTINATION_RESOLVER,
  RecipientDestinationResolver,
  ResolvedRecipientDestinations,
} from '../ports/resolution/recipient-destination-resolver.port';

@Injectable()
export class NotificationRequestPreparation {
  constructor(
    @Inject(RECIPIENT_DESTINATION_RESOLVER)
    private readonly destinationResolver: RecipientDestinationResolver,
    @Inject(NOTIFICATION_CONTEXT_RESOLVER)
    private readonly contextResolver: NotificationContextResolver,
  ) {}

  async prepare<T extends NotificationType>(
    input: NotificationInput<T>,
  ): Promise<PreparedNotification<T>> {
    const [resolvedDestinations, context] = await Promise.all([
      this.destinationResolver.resolveDestinations(input.recipient),
      this.contextResolver.resolveContext(input),
    ]);

    return Object.freeze({
      sourceEventId: input.sourceEventId,
      type: input.type,
      recipient: input.recipient,
      channels: Object.freeze([...input.channels]),
      destinations: Object.freeze(this.mapDestinations(resolvedDestinations)),
      reference: input.reference,
      context,
    });
  }
  
  private mapDestinations(
    resolved: ResolvedRecipientDestinations | undefined | null,
  ): PreparedDestinations {
    const destinations: { email?: string; whatsapp?: string } = {};
    if (resolved?.email != null) {
      destinations.email = resolved.email;
    }
    if (resolved?.whatsapp != null) {
      destinations.whatsapp = resolved.whatsapp;
    }
    return destinations;
  }
}