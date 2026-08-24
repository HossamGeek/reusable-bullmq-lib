import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { CreateNotificationTables20260823000001 } from '../migrations';
import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../../../../domain/enums/notification-delivery-status.enum';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum';
import { NotificationType } from '../../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../../domain/enums/reference-type.enum';
import { OrderCreatedContext } from '../../../../domain/contexts/order-created.context';
import { NotificationReference } from '../../../../domain/value-objects/notification-reference.value-object';
import { Recipient } from '../../../../domain/value-objects/recipient.value-object';
import { Notification } from '../../../../domain/entities/notification.entity';
import { NotificationDelivery } from '../../../../domain/entities/notification-delivery.entity';
import { NotificationOrmEntity } from '../entities/notification.orm-entity';
import { NotificationDeliveryOrmEntity } from '../entities/notification-delivery.orm-entity';
import { NotificationOutboxOrmEntity } from '../entities/notification-outbox.orm-entity';
import { TypeOrmNotificationRepository } from './typeorm-notification.repository';
import { TypeOrmNotificationDeliveryRepository } from './typeorm-notification-delivery.repository';
import { TypeOrmNotificationOutboxRepository } from './typeorm-notification-outbox.repository';

/**
 * Real-PostgreSQL persistence tests.
 *
 * Opt-in via `RUN_INTEGRATION_TESTS=true` (see `.env.example`) so plain unit
 * runs never require a database. When enabled they execute the actual
 * migration against the configured `DB_*` database and prove schema parity,
 * unique constraints, FK cascade behavior, JSONB round-trips, column
 * defaults, and recipient-address snapshot semantics.
 */
const describeIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Notification persistence (PostgreSQL)', () => {
  let dataSource: DataSource;
  let notificationRepository: TypeOrmNotificationRepository;
  let deliveryRepository: TypeOrmNotificationDeliveryRepository;
  let outboxRepository: TypeOrmNotificationOutboxRepository;
  const createdNotificationIds: string[] = [];

  const uniqueEventId = () => `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const buildNotification = (
    overrides?: Partial<{
      sourceEventId: string;
      recipientId: string;
      type: NotificationType;
    }>,
  ): Notification =>
    Notification.create({
      sourceEventId: overrides?.sourceEventId ?? uniqueEventId(),
      recipient: Recipient.create(
        RecipientType.CLIENT,
        overrides?.recipientId ?? '42',
        'client@example.com',
      ),
      type: overrides?.type ?? NotificationType.ORDER_CREATED,
      reference: NotificationReference.create(ReferenceType.ORDER, '1001'),
      context: {
        orderId: '1001',
        orderNumber: 'ORD-1001',
        clientId: '42',
        invoice: { id: 'INV-9', number: '2026-0009' },
      } satisfies OrderCreatedContext,
    });

  const trackAndSave = async (notification: Notification): Promise<Notification> => {
    const saved = await notificationRepository.save(notification);
    createdNotificationIds.push(saved.id as string);
    return saved;
  };

  beforeAll(async () => {
    dotenv.config();
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: false,
      entities: [
        NotificationOrmEntity,
        NotificationDeliveryOrmEntity,
        NotificationOutboxOrmEntity,
      ],
      migrations: [CreateNotificationTables20260823000001],
    });
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'each' });
    notificationRepository = new TypeOrmNotificationRepository(dataSource.getRepository(NotificationOrmEntity));
    deliveryRepository = new TypeOrmNotificationDeliveryRepository(
      dataSource.getRepository(NotificationDeliveryOrmEntity),
    );
    outboxRepository = new TypeOrmNotificationOutboxRepository(
      dataSource.getRepository(NotificationOutboxOrmEntity),
    );
  }, 60000);

  afterAll(async () => {
    // Best-effort cleanup; cascades remove deliveries and outbox rows.
    for (const id of createdNotificationIds) {
      await dataSource.query(`DELETE FROM notifications WHERE id = $1`, [id]);
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('created a schema exactly matching the entity definitions', async () => {
    const expectedColumns: Record<string, Record<string, { type: string; nullable: boolean }>> = {
      notifications: {
        id: { type: 'bigint', nullable: false },
        source_event_id: { type: 'character varying', nullable: false },
        recipient_type: { type: 'character varying', nullable: false },
        recipient_id: { type: 'bigint', nullable: false },
        type: { type: 'character varying', nullable: false },
        reference_type: { type: 'character varying', nullable: false },
        reference_id: { type: 'character varying', nullable: false },
        context: { type: 'jsonb', nullable: false },
        status: { type: 'character varying', nullable: false },
        created_at: { type: 'timestamp with time zone', nullable: false },
        updated_at: { type: 'timestamp with time zone', nullable: false },
      },
      notification_deliveries: {
        id: { type: 'bigint', nullable: false },
        notification_id: { type: 'bigint', nullable: false },
        channel: { type: 'character varying', nullable: false },
        recipient_address: { type: 'character varying', nullable: false },
        status: { type: 'character varying', nullable: false },
        attempt_count: { type: 'integer', nullable: false },
        provider_message_id: { type: 'character varying', nullable: true },
        last_error: { type: 'text', nullable: true },
        sent_at: { type: 'timestamp with time zone', nullable: true },
        created_at: { type: 'timestamp with time zone', nullable: false },
        updated_at: { type: 'timestamp with time zone', nullable: false },
      },
      notification_outbox: {
        id: { type: 'bigint', nullable: false },
        delivery_id: { type: 'bigint', nullable: false },
        published_at: { type: 'timestamp with time zone', nullable: true },
        publish_attempts: { type: 'integer', nullable: false },
        last_publish_error: { type: 'text', nullable: true },
        next_publish_at: { type: 'timestamp with time zone', nullable: true },
        created_at: { type: 'timestamp with time zone', nullable: false },
      },
    };

    for (const [table, columns] of Object.entries(expectedColumns)) {
      const rows: Array<{ column_name: string; data_type: string; is_nullable: string }> =
        await dataSource.query(
          `SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1`,
          [table],
        );
      expect(rows).toHaveLength(Object.keys(columns).length);
      for (const row of rows) {
        const expected = columns[row.column_name];
        expect(expected).toBeDefined();
        expect([row.data_type, row.is_nullable === 'YES']).toEqual([
          expected.type,
          expected.nullable,
        ]);
      }
    }

    const indexes: Array<{ indexname: string }> = await dataSource.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('IDX_notifications_source_event_id',
                            'IDX_notification_deliveries_notification_id',
                            'IDX_notification_outbox_publishable',
                            'IDX_notification_outbox_published_at',
                            'IDX_notification_outbox_next_publish_at')`,
    );
    // Exactly one outbox polling index must exist: the partial composite.
    expect(new Set(indexes.map((row) => row.indexname))).toEqual(
      new Set([
        'IDX_notifications_source_event_id',
        'IDX_notification_deliveries_notification_id',
        'IDX_notification_outbox_publishable',
      ]),
    );

    const publishableIndexes: Array<{ indexdef: string }> = await dataSource.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'IDX_notification_outbox_publishable'`,
    );
    expect(publishableIndexes).toHaveLength(1);
    expect(publishableIndexes[0].indexdef).toMatch(/created_at.*next_publish_at/s);
    expect(publishableIndexes[0].indexdef).toMatch(/WHERE.*published_at.*IS NULL/is);

    const uniques: Array<{ conname: string }> = await dataSource.query(
      `SELECT conname FROM pg_constraint
        WHERE contype = 'u'
          AND conname IN ('UQ_notifications_source_recipient_type',
                          'UQ_notification_deliveries_notification_channel',
                          'UQ_notification_outbox_delivery')`,
    );
    expect(new Set(uniques.map((row) => row.conname))).toEqual(
      new Set([
        'UQ_notifications_source_recipient_type',
        'UQ_notification_deliveries_notification_channel',
        'UQ_notification_outbox_delivery',
      ]),
    );
  });

  it('applies database defaults on raw inserts', async () => {
    const inserted: Array<Record<string, unknown>> = await dataSource.query(
      `INSERT INTO notifications
         (source_event_id, recipient_type, recipient_id, type, reference_type, reference_id, context)
       VALUES ($1, 'CLIENT', 42, 'ORDER_CREATED', 'ORDER', '1001', $2::jsonb)
       RETURNING *`,
      [uniqueEventId(), JSON.stringify({ orderId: '1001' })],
    );
    const row = inserted[0];
    createdNotificationIds.push(String(row.id));
    expect(row.status).toBe('PENDING');
    expect(row.created_at).not.toBeNull();
    expect(row.updated_at).not.toBeNull();

    const deliveryRows: Array<Record<string, unknown>> = await dataSource.query(
      `INSERT INTO notification_deliveries (notification_id, channel, recipient_address)
       VALUES ($1, 'EMAIL', 'client@example.com')
       RETURNING *`,
      [row.id],
    );
    expect(deliveryRows[0].status).toBe('PENDING');
    expect(deliveryRows[0].attempt_count).toBe(0);

    const outboxRows: Array<Record<string, unknown>> = await dataSource.query(
      `INSERT INTO notification_outbox (delivery_id) VALUES ($1) RETURNING *`,
      [deliveryRows[0].id],
    );
    expect(outboxRows[0].publish_attempts).toBe(0);
    expect(outboxRows[0].published_at).toBeNull();
  });

  it('enforces the notification identity tuple uniqueness', async () => {
    const sourceEventId = uniqueEventId();
    await trackAndSave(buildNotification({ sourceEventId }));

    await expect(trackAndSave(buildNotification({ sourceEventId }))).rejects.toThrow(
      /UQ_notifications_source_recipient_type/,
    );

    // Same event, different recipient -> allowed.
    const otherRecipient = await trackAndSave(buildNotification({ sourceEventId, recipientId: '43' }));
    expect(otherRecipient.recipient.id).toBe('43');
  });

  it('round-trips the typed JSONB context through the repositories', async () => {
    const saved = await trackAndSave(buildNotification());
    const loaded = await notificationRepository.findById(saved.id as string);

    expect(loaded).not.toBeNull();
    const context = loaded!.typedContext(NotificationType.ORDER_CREATED);
    expect(context).toEqual({
      orderId: '1001',
      orderNumber: 'ORD-1001',
      clientId: '42',
      invoice: { id: 'INV-9', number: '2026-0009' },
    });
    expect(await notificationRepository.findById('999999')).toBeNull();
  });

  it('persists status transitions through the update path of save', async () => {
    const saved = await trackAndSave(buildNotification());

    await notificationRepository.save(
      Notification.fromPersistence({
        id: saved.id as string,
        sourceEventId: saved.sourceEventId,
        recipient: saved.recipient,
        type: saved.type,
        reference: saved.reference,
        context: saved.context,
        status: NotificationStatus.SENT,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      }),
    );

    const reloaded = await notificationRepository.findById(saved.id as string);
    expect(reloaded?.status).toBe(NotificationStatus.SENT);
  });

  it('allows one delivery per channel and lists them per notification', async () => {
    const notification = await trackAndSave(buildNotification());
    const notificationId = notification.id as string;

    await deliveryRepository.save(
      NotificationDelivery.create({
        notificationId,
        channel: NotificationChannel.EMAIL,
        recipientAddress: 'client@example.com',
      }),
    );
    await deliveryRepository.save(
      NotificationDelivery.create({
        notificationId,
        channel: NotificationChannel.WHATSAPP,
        recipientAddress: '+966500000000',
      }),
    );
    await expect(
      deliveryRepository.save(
        NotificationDelivery.create({
          notificationId,
          channel: NotificationChannel.EMAIL,
          recipientAddress: 'again@example.com',
        }),
      ),
    ).rejects.toThrow(/UQ_notification_deliveries_notification_channel/);

    const deliveries = await deliveryRepository.findDeliveriesByNotificationId(notificationId);
    expect(deliveries.map((delivery) => delivery.channel)).toEqual([
      NotificationChannel.EMAIL,
      NotificationChannel.WHATSAPP,
    ]);
  });

  it('keeps the recipient address snapshot immutable across later updates', async () => {
    const notification = await trackAndSave(buildNotification());
    const delivery = await deliveryRepository.save(
      NotificationDelivery.create({
        notificationId: notification.id as string,
        channel: NotificationChannel.EMAIL,
        recipientAddress: 'snapshot@example.com',
      }),
    );

    // Simulate a later provider send touching other columns.
    await dataSource.query(
      `UPDATE notification_deliveries SET status = 'SENT', sent_at = now(), attempt_count = 1 WHERE id = $1`,
      [delivery.id],
    );

    const reloaded = await deliveryRepository.findById(delivery.id as string);
    expect(reloaded?.status).toBe(NotificationDeliveryStatus.SENT);
    expect(reloaded?.attemptCount).toBe(1);
    expect(reloaded?.recipientAddress).toBe('snapshot@example.com');
  });

  it('stores exactly one outbox row per delivery and returns publishable rows in order', async () => {
    // Each delivery lives on its own notification because
    // (notification_id, channel) is unique. Publishable ordering is made
    // deterministic through explicit outbox createdAt values below.
    const createDelivery = async () => {
      const notification = await trackAndSave(buildNotification());
      return deliveryRepository.save(
        NotificationDelivery.create({
          notificationId: notification.id as string,
          channel: NotificationChannel.EMAIL,
          recipientAddress: `outbox-${Math.random().toString(36).slice(2)}@example.com`,
        }),
      );
    };

    const published = await createDelivery();
    const scheduled = await createDelivery();
    const due = await createDelivery();
    const immediate = await createDelivery();

    await outboxRepository.save({
      id: null,
      deliveryId: published.id as string,
      publishedAt: new Date(),
      publishAttempts: 1,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: null,
    });
    await outboxRepository.save({
      id: null,
      deliveryId: scheduled.id as string,
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: new Date(Date.now() + 3_600_000),
      createdAt: new Date(1000),
    });
    await outboxRepository.save({
      id: null,
      deliveryId: due.id as string,
      publishedAt: null,
      publishAttempts: 2,
      lastPublishError: 'temporary provider outage',
      nextPublishAt: new Date(Date.now() - 1_000),
      createdAt: new Date(2000),
    });
    await outboxRepository.save({
      id: null,
      deliveryId: immediate.id as string,
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: new Date(3000),
    });

    // One outbox row per delivery is enforced by the unique constraint.
    await expect(
      outboxRepository.save({
        id: null,
        deliveryId: immediate.id as string,
        publishedAt: null,
        publishAttempts: 0,
        lastPublishError: null,
        nextPublishAt: null,
        createdAt: null,
      }),
    ).rejects.toThrow(/UQ_notification_outbox_delivery/);

    const publishable = await outboxRepository.findPublishable();
    expect(publishable.map((record) => record.deliveryId)).toEqual([
      due.id,
      immediate.id,
    ]);
    expect(publishable[0].lastPublishError).toBe('temporary provider outage');

    const limited = await outboxRepository.findPublishable({ limit: 1 });
    expect(limited.map((record) => record.deliveryId)).toEqual([due.id]);

    const loaded = await outboxRepository.findById(publishable[0].id as string);
    expect(loaded?.deliveryId).toBe(due.id);
  });

  it('cascades deletes from notifications down to outbox rows', async () => {
    const notification = await trackAndSave(buildNotification());
    const notificationId = notification.id as string;
    const delivery = await deliveryRepository.save(
      NotificationDelivery.create({
        notificationId,
        channel: NotificationChannel.EMAIL,
        recipientAddress: 'cascade@example.com',
      }),
    );
    await outboxRepository.save({
      id: null,
      deliveryId: delivery.id as string,
      publishedAt: null,
      publishAttempts: 0,
      lastPublishError: null,
      nextPublishAt: null,
      createdAt: null,
    });

    await dataSource.query(`DELETE FROM notifications WHERE id = $1`, [notificationId]);

    const remainingDeliveries = await dataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM notification_deliveries WHERE notification_id = $1`,
      [notificationId],
    );
    const remainingOutbox = await dataSource.query<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count FROM notification_outbox WHERE delivery_id = $1`,
      [delivery.id],
    );
    expect(remainingDeliveries[0].count).toBe(0);
    expect(remainingOutbox[0].count).toBe(0);

    // Already cleaned up by the cascade; avoid double delete in afterAll.
    const index = createdNotificationIds.indexOf(notificationId);
    if (index >= 0) {
      createdNotificationIds.splice(index, 1);
    }
  });
});
