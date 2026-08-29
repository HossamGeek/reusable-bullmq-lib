import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { NotificationDeliveryOrmEntity } from './notification-delivery.orm-entity';

@Entity('notification_outbox')
@Unique('UQ_notification_outbox_delivery', ['delivery'])
@Index('IDX_notification_outbox_publishable', ['createdAt', 'nextPublishAt'], {
  where: '"published_at" IS NULL',
})
export class NotificationOutboxOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => NotificationDeliveryOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery!: NotificationDeliveryOrmEntity;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'publish_attempts', type: 'integer', default: 0 })
  publishAttempts!: number;

  @Column({ name: 'last_publish_error', type: 'text', nullable: true })
  lastPublishError!: string | null;

  @Column({ name: 'next_publish_at', type: 'timestamptz', nullable: true })
  nextPublishAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
