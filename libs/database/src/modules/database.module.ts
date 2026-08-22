import { Global, Module } from '@nestjs/common';
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
      inject: [DatabaseOptionsFactory],
      useFactory: (factory: DatabaseOptionsFactory) => factory.createTypeOrmOptions(),
    }),
  ],
  providers: [DatabaseOptionsFactory],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
