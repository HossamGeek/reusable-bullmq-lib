import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

/**
 * Environment contract required by the database infrastructure.
 * Validated synchronously during `ConfigModule.forRoot` so the app fails fast
 * before any module (or database connection) is initialized.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;
}
