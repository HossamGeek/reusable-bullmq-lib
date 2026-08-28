import { OrderCreatedContext } from '../../domain/contexts/order-created.context';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { RecipientType } from '../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../domain/enums/reference-type.enum';
import { NotificationInput } from '../dto/notification-input.dto';
import { ResolvedRecipientDestinations } from '../ports/resolution/recipient-destination-resolver.port';
import { NotificationRequestPreparation } from './notification-request-preparation.service';

describe('NotificationRequestPreparation', () => {
  const input: NotificationInput<NotificationType.ORDER_CREATED> = {
    sourceEventId: 'evt-1',
    type: NotificationType.ORDER_CREATED,
    recipient: { type: RecipientType.CLIENT, id: '42' },
    reference: { type: ReferenceType.ORDER, id: '1001' },
    channels: [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP],
  };

  const context: OrderCreatedContext = {
    orderId: '1001',
    orderNumber: 'ORD-1001',
    clientId: '42',
  };

  let resolveDestinations: jest.Mock;
  let resolveContext: jest.Mock;
  let preparation: NotificationRequestPreparation;

  beforeEach(() => {
    resolveDestinations = jest.fn().mockResolvedValue({
      email: 'client@example.com',
      whatsapp: '+966500000000',
    });
    resolveContext = jest.fn().mockResolvedValue({ ...context });
    preparation = new NotificationRequestPreparation(
      { resolveDestinations },
      { resolveContext },
    );
  });

  it('resolves destinations and context once each and assembles a flattened prepared notification', async () => {
    const prepared = await preparation.prepare(input);

    expect(resolveDestinations).toHaveBeenCalledTimes(1);
    expect(resolveDestinations).toHaveBeenCalledWith(input.recipient);
    expect(resolveContext).toHaveBeenCalledTimes(1);
    expect(resolveContext).toHaveBeenCalledWith(input);

    // Flattened: no nested `request` object.
    expect(prepared).not.toHaveProperty('request');
    expect(prepared.sourceEventId).toBe('evt-1');
    expect(prepared.type).toBe(NotificationType.ORDER_CREATED);
    expect(prepared.recipient).toEqual(input.recipient);
    expect(prepared.reference).toEqual(input.reference);
    expect(prepared.destinations).toEqual({
      email: 'client@example.com',
      whatsapp: '+966500000000',
    });
    expect(prepared.context).toEqual(context);
  });

  it('starts both resolver calls before awaiting either result (parallel)', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const destinations = new Promise<ResolvedRecipientDestinations>((resolve) => {
      resolveFirst = () => resolve({ email: 'client@example.com' });
    });
    const resolvedContext = new Promise<OrderCreatedContext>((resolve) => {
      resolveSecond = () => resolve({ ...context });
    });
    resolveDestinations.mockReturnValue(destinations);
    resolveContext.mockReturnValue(resolvedContext);

    const pending = preparation.prepare(input);

    // Both resolvers must have been invoked before either promise resolved.
    expect(resolveDestinations).toHaveBeenCalledTimes(1);
    expect(resolveContext).toHaveBeenCalledTimes(1);

    resolveFirst();
    resolveSecond();
    await expect(pending).resolves.toMatchObject({
      destinations: { email: 'client@example.com' },
      context,
    });
  });

  it('carries the declared channels through unchanged in order', async () => {
    const prepared = await preparation.prepare(input);

    expect(prepared.channels).toEqual([
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ]);
    expect(Object.isFrozen(prepared.channels)).toBe(true);
  });

  it('copies the channels list so later caller mutation cannot leak in', async () => {
    const channels = [NotificationChannel.EMAIL, NotificationChannel.WHATSAPP];
    const prepared = await preparation.prepare({ ...input, channels });

    channels.push(NotificationChannel.EMAIL);

    expect(prepared.channels).toEqual([
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ]);
  });

  it('maps null/undefined resolver entries to absent destinations without format validation', async () => {
    resolveDestinations.mockResolvedValue({ email: null, whatsapp: undefined });
    const prepared = await preparation.prepare(input);
    expect(prepared.destinations).toEqual({});

    // Malformed-but-present values pass through untouched: preparation does
    // not validate destination formats anymore.
    resolveDestinations.mockResolvedValue({ email: 'not-an-email' });
    const unvalidated = await preparation.prepare(input);
    expect(unvalidated.destinations).toEqual({ email: 'not-an-email' });
  });

  it('propagates resolver failures without assembling anything', async () => {
    const failure = new Error('destination lookup failed');
    resolveDestinations.mockRejectedValue(failure);

    await expect(preparation.prepare(input)).rejects.toBe(failure);
    expect(resolveContext).toHaveBeenCalledTimes(1);
  });
});