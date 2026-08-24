import { NotificationType } from '../enums/notification-type.enum';
import { InvoiceReference } from './invoice-reference.type';

export interface OrderDeliveredContext {
  orderId: string;
  orderNumber: string;
  clientId: string;
  deliveredAt: string;
  invoice?: InvoiceReference;
}

export const ORDER_DELIVERED_TYPE = NotificationType.ORDER_DELIVERED;
