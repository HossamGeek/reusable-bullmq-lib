import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NotificationChannel } from '../../domain/enums/notification-channel.enum';
import { NotificationType } from '../../domain/enums/notification-type.enum';
import { RecipientType } from '../../domain/enums/recipient-type.enum';
import { ReferenceType } from '../../domain/enums/reference-type.enum';

export class NotificationRecipientDto {
  @IsEnum(RecipientType)
  type!: RecipientType;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  id!: string;
}

export class NotificationReferenceDto {
  @IsEnum(ReferenceType)
  type!: ReferenceType;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  id!: string;
}

/**
 * Transport-independent create-notification contract shared by every
 * transport adapter (HTTP, NATS, gRPC, ...). Contains no transport
 * decorators/types and no resolved destinations or context: adapters validate
 * this DTO, map it to `NotificationInput`, and call
 * `NotificationApplicationService.create`.
 */
export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  sourceEventId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationRecipientDto)
  recipient!: NotificationRecipientDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationReferenceDto)
  reference!: NotificationReferenceDto;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationChannel, { each: true })
  @ArrayUnique()
  channels!: NotificationChannel[];
}