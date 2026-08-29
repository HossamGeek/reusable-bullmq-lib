import { Injectable } from '@nestjs/common';
import {
  NotificationInputRecipient,
  RecipientDestinationResolver,
  ResolvedRecipientDestinations,
} from '@app/notification';
@Injectable()
export class DemoRecipientDestinationResolver implements RecipientDestinationResolver {
  resolveDestinations(
    recipient: NotificationInputRecipient,
  ): Promise<ResolvedRecipientDestinations> {
    return Promise.resolve({ email: `${recipient.id}@demo.local`, whatsapp: `+1${recipient.id}` });
  }
}
