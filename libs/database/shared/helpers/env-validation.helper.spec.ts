import { validateEnvironment } from './env-validation.helper';

const validEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'secret',
  DB_NAME: 'microapp',
};

describe('validateEnvironment', () => {
  it('accepts a complete environment and coerces DB_PORT to a number', () => {
    const result = validateEnvironment(validEnv);

    expect(result.DB_PORT).toBe(5432);
    expect(typeof result.DB_PORT).toBe('number');
    expect(result.DB_HOST).toBe('localhost');
    expect(result.DB_NAME).toBe('microapp');
  });

  it('fails fast listing every missing variable', () => {
    expect(() => validateEnvironment({})).toThrow(
      /DB_HOST[\s\S]*DB_PORT[\s\S]*DB_USERNAME[\s\S]*DB_PASSWORD[\s\S]*DB_NAME/,
    );
  });

  it('rejects empty values and out-of-range ports with a meaningful error', () => {
    expect(() => validateEnvironment({ ...validEnv, DB_PASSWORD: '' })).toThrow(
      /Invalid environment configuration[\s\S]*DB_PASSWORD/,
    );
    expect(() => validateEnvironment({ ...validEnv, DB_PORT: '70000' })).toThrow(
      /Invalid environment configuration[\s\S]*DB_PORT/,
    );
  });
});
