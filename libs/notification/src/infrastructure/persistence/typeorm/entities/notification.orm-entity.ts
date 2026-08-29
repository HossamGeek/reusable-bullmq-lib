import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { NotificationStatus } from '../../../../domain/enums/notification-status.enum';
import { NotificationType } from '../../../../domain/enums/notification-type.enum';
import { RecipientType } from '../../../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../../../domain/enums/reference-type.enum';

/**
 * Persistence model for the `notifications` table.
 *
 * - Ids are PostgreSQL BIGINT exposed as TypeScript strings.
 * - Timestamps use `timestamptz`.
 * - Enum-backed columns are stored as varchar so enum evolution never
 *   requires native PostgreSQL enum type migrations.
 * - `reference_type`/`reference_id` are loose cross-context references and
 *   intentionally carry no database foreign key.
 */
@Entity('notifications')
@Unique('UQ_notifications_source_recipient_type', [
  'sourceEventId',
  'recipientType',
  'recipientId',
  'type',
])
@Index('IDX_notifications_source_event_id', ['sourceEventId'])
export class NotificationOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'source_event_id', type: 'varchar', length: 255 })
  sourceEventId!: string;

  @Column({ name: 'recipient_type', type: 'varchar', length: 50 })
  recipientType!: RecipientType;

  @Column({ name: 'recipient_id', type: 'bigint' })
  recipientId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: NotificationType;

  @Column({ name: 'reference_type', type: 'varchar', length: 50 })
  referenceType!: ReferenceType;

  @Column({ name: 'reference_id', type: 'varchar', length: 255 })
  referenceId!: string;

  /** Typed per {@link NotificationContextMap}; stored as opaque JSONB here. */
  @Column({ type: 'jsonb' })
  context!: unknown;

  @Column({ type: 'varchar', length: 50, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
