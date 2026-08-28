import { NotificationContextMap } from '../../../domain/contexts/notification-context.map';
import { NotificationType } from '../../../domain/enums/notification-type.enum';
import { NotificationInput } from '../../dto/notification-input.dto';

/**
 * Injection token for the {@link NotificationContextResolver} port.
 */
export const NOTIFICATION_CONTEXT_RESOLVER = Symbol('NOTIFICATION_CONTEXT_RESOLVER');

/**
 * Resolves the typed context payload for a notification input.
 *
 * Implemented by the owning domain (e.g. orders); must return JSON-safe data
 * matching {@link NotificationContextMap} for the requested type. Called
 * exactly once per input, before any persistence transaction opens.
 */
export interface NotificationContextResolver {
  resolveContext<T extends NotificationType>(
    input: NotificationInput<T>,
  ): Promise<NotificationContextMap[T]>;
}