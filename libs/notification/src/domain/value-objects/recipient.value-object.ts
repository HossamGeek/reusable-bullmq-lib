import { RecipientType } from '../enums/recipient-type.enum';
export class Recipient {
  private constructor(
    readonly type: RecipientType,
    readonly id: string,
    readonly address: string | null,
  ) {}

  static create(type: RecipientType, id: string, address?: string | null): Recipient {
    if (!id || !id.trim()) {
      throw new Error('Recipient id is required.');
    }
    return new Recipient(type, id, address ?? null);
  }
}
