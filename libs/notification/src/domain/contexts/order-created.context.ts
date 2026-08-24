import { NotificationType } from '../enums/notification-type.enum';
import { InvoiceReference } from './invoice-reference.type';
export interface OrderCreatedContext {
  orderId: string;
  orderNumber: string;
  clientId: string;
  providerId?: string;
  totalAmount?: string;
  currency?: string;
  invoice?: InvoiceReference;
}

/** Brand literal tying the context to its notification type. */
export const ORDER_CREATED_TYPE = NotificationType.ORDER_CREATED;
