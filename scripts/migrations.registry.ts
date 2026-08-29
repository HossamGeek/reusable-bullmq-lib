import { DataSource } from 'typeorm';
import { createMigrationsDataSource } from '../libs/notification/src/infrastructure/persistence/typeorm/migrations';

/**
 * Workspace registry of migration-owning libraries.
 *
 * Every feature library keeps its migration files and their registration
 * isolated inside its own persistence layer and exports a standalone
 * `createMigrationsDataSource()` factory from its local migrations barrel.
 * Registering that factory here is the only step required to make a library
 * available to the shared migration CLI (`scripts/migrations.cli.ts`); no
 * additional package scripts are needed.
 *
 * Relative imports keep the CLI runnable through plain `ts-node` without
 * path-alias registration.
 */
export const migrationModules: Readonly<Record<string, () => DataSource>> = {
  notification: createMigrationsDataSource,
};
