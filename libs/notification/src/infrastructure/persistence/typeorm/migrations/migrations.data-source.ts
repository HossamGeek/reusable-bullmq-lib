import { DataSource } from 'typeorm';
import { CreateNotificationTables20260823000001 } from './20260823000001-create-notification-tables.migration';

export const migrations = [CreateNotificationTables20260823000001];
export function createMigrationsDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_NAME as string,
    synchronize: false,
    logging: false,
    migrations,
    migrationsRun: false,
  });
}
