import { Injectable } from '@nestjs/common';
import {
  NotificationContextMap,
  NotificationContextResolver,
  NotificationInput,
  NotificationType,
  OrderCreatedContext,
} from '@app/notification';
@Injectable()
export class DemoNotificationContextResolver implements NotificationContextResolver {
  resolveContext<T extends NotificationType>(
    input: NotificationInput<T>,
  ): Promise<NotificationContextMap[T]> {
    const context: OrderCreatedContext = {
      orderId: input.reference.id,
      orderNumber: `ORD-${input.reference.id}`,
      clientId: input.recipient.id,
    };
    return Promise.resolve(context as NotificationContextMap[T]);
  }
}
