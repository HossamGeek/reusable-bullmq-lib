import { ReferenceType } from '../enums/reference-type.enum';
export class NotificationReference {
  private constructor(
    readonly type: ReferenceType,
    readonly id: string,
  ) {}

  static create(type: ReferenceType, id: string): NotificationReference {
    if (!id || !id.trim()) {
      throw new Error('Notification reference id is required.');
    }
    return new NotificationReference(type, id);
  }
}
