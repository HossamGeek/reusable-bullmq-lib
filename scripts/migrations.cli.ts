import { DataSource } from 'typeorm';
import { migrationModules } from './migrations.registry';

/** Migration commands, one per generic `migration:*` package script. */
export type MigrationCommand = 'run' | 'revert' | 'show';

const COMMANDS: readonly MigrationCommand[] = ['run', 'revert', 'show'];

function isMigrationCommand(value: string): value is MigrationCommand {
  return (COMMANDS as readonly string[]).includes(value);
}

/**
 * Resolves the migration command from an explicit argument or derives it
 * from the npm lifecycle event (`migration:<command>`).
 */
function resolveCommand(
  explicitCommand: string | undefined,
  lifecycleEvent?: string,
): MigrationCommand {
  const candidate = explicitCommand ?? lifecycleEvent?.replace(/^migration:/, '');
  if (!candidate) {
    throw new Error(
      'Missing migration command. Pass it explicitly or run through an npm migration:* script.',
    );
  }
  if (!isMigrationCommand(candidate)) {
    throw new Error(`Unknown command "${candidate}". Supported commands: ${COMMANDS.join(', ')}.`);
  }
  return candidate;
}

/**
 * Resolves the target module and command from CLI input.
 *
 * The command comes either from an explicit second argument (direct
 * `ts-node` usage) or is derived from the npm lifecycle event so that
 * `npm run migration:run -- notification` resolves to `run`.
 */
export function parseMigrationArgs(
  args: readonly string[],
  lifecycleEvent?: string,
): { moduleName: string; command: MigrationCommand } {
  if (args.length === 0 || !args[0]) {
    throw new Error(
      `Missing migration module. Usage: npm run migration:<command> -- <module>. Available modules: ${Object.keys(migrationModules).join(', ')}`,
    );
  }
  if (args.length > 2) {
    throw new Error(`Unexpected extra arguments: ${args.slice(2).join(' ')}`);
  }

  const [moduleName, explicitCommand] = args;
  return { moduleName, command: resolveCommand(explicitCommand, lifecycleEvent) };
}

/** Dispatches a single migration command against an initialized data source. */
export async function executeMigrationCommand(
  dataSource: DataSource,
  command: MigrationCommand,
): Promise<string> {
  switch (command) {
    case 'run':
      await dataSource.runMigrations();
      return 'Migrations applied.';
    case 'revert':
      await dataSource.undoLastMigration();
      return 'Last migration reverted.';
    case 'show': {
      const hasPending = await dataSource.showMigrations();
      return hasPending ? 'Pending migrations exist.' : 'No pending migrations.';
    }
  }
}

/**
 * Runs one migration command for one registered module.
 *
 * The data source is always destroyed, even when the command fails, so the
 * process never leaks a connection pool.
 */
export async function runMigrationCli(
  args: readonly string[],
  lifecycleEvent?: string,
  modules: Readonly<Record<string, () => DataSource>> = migrationModules,
): Promise<string> {
  const { moduleName, command } = parseMigrationArgs(args, lifecycleEvent);

  const createDataSource = modules[moduleName];
  if (!createDataSource) {
    throw new Error(
      `Unknown migration module "${moduleName}". Available modules: ${Object.keys(modules).join(', ')}`,
    );
  }

  const dataSource = createDataSource();
  await dataSource.initialize();
  try {
    return await executeMigrationCommand(dataSource, command);
  } finally {
    await dataSource.destroy();
  }
}

async function main(): Promise<void> {
  console.log(await runMigrationCli(process.argv.slice(2), process.env.npm_lifecycle_event));
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
