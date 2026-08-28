import { Type } from 'class-transformer';
import {
  IsDateString,
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
 * Context contract for ORDER_DELIVERED notifications.
 *
 * Decorated so the registry-based context validator can enforce the contract
 * with class-validator on a transformed copy; the event-time payload itself
 * is never replaced by a class instance.
 */
export class OrderDeliveredContext {
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

  @IsString()
  @IsNotEmpty()
  @IsDateString()
  deliveredAt!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvoiceReference)
  invoice?: InvoiceReference;
}

export const ORDER_DELIVERED_TYPE = NotificationType.ORDER_DELIVERED;