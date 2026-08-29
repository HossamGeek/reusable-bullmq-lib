import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
import { InvoiceReference } from './invoice-reference.type';

/**
 * Context contract for ORDER_CREATED notifications.
 *
 * Decorated so the registry-based context validator can enforce the contract
 * with class-validator on a transformed copy; the event-time payload itself
 * is never replaced by a class instance.
 */
export class OrderCreatedContext {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  orderNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  clientId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  providerId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  totalAmount?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  currency?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvoiceReference)
  invoice?: InvoiceReference;
}

/** Brand literal tying the context to its notification type. */
export const ORDER_CREATED_TYPE = NotificationType.ORDER_CREATED;