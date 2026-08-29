import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseConfiguration } from '../config';
@Injectable()
export class DatabaseOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const database = this.configService.get<DatabaseConfiguration>('database');

    if (!database) {
      throw new Error(
        'Database configuration is missing. Import SharedConfigModule (or configure the "database" section) before using DatabaseModule.',
      );
    }

    return {
      type: 'postgres',
      host: database.host,
      port: database.port,
      username: database.username,
      password: database.password,
      database: database.name,
      autoLoadEntities: true,
      // Infrastructure library defaults: schema changes belong to migrations.
      synchronize: false,
      logging: false,
    };
  }
}
