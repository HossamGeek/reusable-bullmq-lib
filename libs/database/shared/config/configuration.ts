export interface DatabaseConfiguration {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
}

/**
 * Default `ConfigModule` loader. Reads the DB_* variables that were already
 * validated by `validateEnvironment`; no defaults are invented here so a
 * missing variable surfaces as a validation error instead of silent behavior.
 */
export default (): { database: DatabaseConfiguration } => ({
  database: {
    host: process.env.DB_HOST as string,
    port: parseInt(process.env.DB_PORT as string, 10),
    username: process.env.DB_USERNAME as string,
    password: process.env.DB_PASSWORD as string,
    name: process.env.DB_NAME as string,
  },
});
