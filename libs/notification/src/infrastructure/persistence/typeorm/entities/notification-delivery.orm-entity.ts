import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from '../../../../domain/enums/notification-channel.enum';
import { NotificationDeliveryStatus } from '../../../../domain/enums/notification-delivery-status.enum';
import { NotificationOrmEntity } from './notification.orm-entity';

/**
 * Persistence model for the `notification_deliveries` table.
 */
@Entity('notification_deliveries')
@Unique('UQ_notification_deliveries_notification_channel', ['notification', 'channel'])
@Index('IDX_notification_deliveries_notification_id', ['notification'])
export class NotificationDeliveryOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => NotificationOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification!: NotificationOrmEntity;

  @Column({ type: 'varchar', length: 50 })
  channel!: NotificationChannel;

  @Column({ name: 'recipient_address', type: 'varchar', length: 255 })
  recipientAddress!: string;

  @Column({ type: 'varchar', length: 50, default: NotificationDeliveryStatus.PENDING })
  status!: NotificationDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
