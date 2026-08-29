import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { databaseConfiguration, validateEnvironment } from '../../shared/config';

/**
 * Shared configuration module wrapping Nest's `ConfigModule.forRoot`.
 *
 * Registers the `.env` file, the namespaced database configuration loader,
 * and the synchronous environment validation so invalid/missing variables
 * fail fast during bootstrap. Re-exports `ConfigModule` (and therefore
 * `ConfigService`) for consumers that import this module explicitly.
 *
 * Usage: `imports: [SharedConfigModule, DatabaseModule]`
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfiguration],
      validate: validateEnvironment,
    }),
  ],
  exports: [ConfigModule],
})
export class SharedConfigModule {}
