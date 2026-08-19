import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum RetryBackoffType {
  Fixed = 'fixed',
  Exponential = 'exponential',
}

export class EnqueueJobDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  failUntilAttempt?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attempts?: number;
}

export class RetryJobDto extends EnqueueJobDto {
  @IsOptional()
  @IsEnum(RetryBackoffType)
  backoffType?: RetryBackoffType;

  @IsOptional()
  @IsInt()
  @Min(1)
  backoffDelayMs?: number;
}

export class BulkJobDto extends EnqueueJobDto {}

export class BulkDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => BulkJobDto)
  jobs!: BulkJobDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  chunkSize?: number;
}

export class DelayedDto extends EnqueueJobDto {
  @IsInt()
  @Min(1)
  delayMs!: number;
}

export class PriorityDto extends EnqueueJobDto {
  @IsInt()
  @Min(1)
  @Max(2097152)
  priority!: number;
}

export class LoadDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  count!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  chunkSize?: number;

  @IsOptional()
  @IsBoolean()
  deterministicFailures?: boolean;
}
