import { ConfigService } from '@nestjs/config';
import { DatabaseOptionsFactory } from './database-options.factory';

function createConfigService(database: unknown): ConfigService {
  return {
    get: jest.fn(() => database),
  } as unknown as ConfigService;
}

describe('DatabaseOptionsFactory', () => {
  it('builds PostgreSQL options from the shared configuration', () => {
    const factory = new DatabaseOptionsFactory(
      createConfigService({
        host: 'db.internal',
        port: 5433,
        username: 'app',
        password: 'secret',
        name: 'ERP_db',
      }),
    );

    expect(factory.createTypeOrmOptions()).toEqual({
      type: 'postgres',
      host: 'db.internal',
      port: 5433,
      username: 'app',
      password: 'secret',
      database: 'ERP_db',
      autoLoadEntities: true,
      synchronize: false,
      logging: false,
    });
  });

  it('never enables synchronize or logging', () => {
    const factory = new DatabaseOptionsFactory(
      createConfigService({ host: 'h', port: 5432, username: 'u', password: 'p', name: 'd' }),
    );
    const options = factory.createTypeOrmOptions();

    expect(options.synchronize).toBe(false);
    expect(options.logging).toBe(false);
  });

  it('throws a meaningful error when the database configuration is missing', () => {
    const factory = new DatabaseOptionsFactory(createConfigService(undefined));

    expect(() => factory.createTypeOrmOptions()).toThrow(/Database configuration is missing/);
  });
});
