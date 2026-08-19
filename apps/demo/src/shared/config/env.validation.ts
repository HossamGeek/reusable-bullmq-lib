import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';
class EnvDto {
  @IsOptional() @IsString() NODE_ENV?: string;
  @IsOptional() @IsInt() @Min(1) PORT?: number;
  @IsOptional() @IsString() REDIS_HOST?: string;
  @IsOptional() @IsInt() @Min(1) REDIS_PORT?: number;
  @IsOptional() @IsInt() @Min(0) REDIS_DB?: number;
  @IsOptional() @IsString() REDIS_USERNAME?: string;
  @IsOptional() @IsString() REDIS_PASSWORD?: string;
  @IsOptional() @IsString() QUEUE_PREFIX?: string;
  @IsOptional() @IsInt() @Min(1) WORKER_CONCURRENCY?: number;
  @IsOptional() @IsInt() @Min(1) WORKER_LIMITER_MAX?: number;
  @IsOptional() @IsInt() @Min(1) WORKER_LIMITER_DURATION_MS?: number;
}
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvDto, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length) throw new Error(errors.toString());
  return validated as unknown as Record<string, unknown>;
}
