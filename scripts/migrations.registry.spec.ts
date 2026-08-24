import { DataSource } from 'typeorm';
import { migrationModules } from './migrations.registry';

describe('migrationModules registry', () => {
  it('registers the notification library migrations data source factory', () => {
    expect(typeof migrationModules.notification).toBe('function');
  });

  it('exposes data sources that never auto-sync or auto-run migrations', () => {
    const dataSource = migrationModules.notification();

    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.options.migrationsRun).toBe(false);
  });
});
