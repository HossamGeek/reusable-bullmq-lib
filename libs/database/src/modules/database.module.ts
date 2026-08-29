import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseOptionsFactory } from '../../shared/factories';

/**
 * Infrastructure-only PostgreSQL/TypeORM module.
 * Contains no entities, repositories, or migrations; consuming apps register
 * Usage: `imports: [SharedConfigModule, DatabaseModule]`
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // ConfigModule is imported here so ConfigService is resolvable inside
      // the TypeOrmCoreModule context (parent module providers are not visible
      // to forRootAsync's inject array).
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new DatabaseOptionsFactory(configService).createTypeOrmOptions(),
    }),
  ],
  providers: [DatabaseOptionsFactory],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
