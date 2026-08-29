import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Reference metadata for an invoice carried inside a notification context.
 * Only identifiers travel; document/file payloads are never embedded.
 *
 * Decorated so the registry-based context validator can enforce the contract
 * with class-validator on a transformed copy.
 */
export class InvoiceReference {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  id!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  number?: string;
}