import { NotificationInputRecipient } from '../../dto/notification-input.dto';

/**
 * Injection token for the {@link RecipientDestinationResolver} port.
 */
export const RECIPIENT_DESTINATION_RESOLVER = Symbol('RECIPIENT_DESTINATION_RESOLVER');

export interface ResolvedRecipientDestinations {
  readonly email?: string | null;
  readonly whatsapp?: string | null;
}

/**
 * Resolves where a notification recipient can be reached.
 *
 * Implemented by the owning contact/user infrastructure; the creation
 * workflow only depends on this port and resolves once per input (no N+1
 * lookups). Implementations must never run inside the persistence
 * transaction; preparation calls this before any unit of work opens.
 */
export interface RecipientDestinationResolver {
  resolveDestinations(
    recipient: NotificationInputRecipient,
  ): Promise<ResolvedRecipientDestinations>;
}