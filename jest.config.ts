import type { Config } from 'jest';
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: {
    '^@app/bullmq$': '<rootDir>/libs/bullmq/src',
    '^@app/bullmq/(.*)$': '<rootDir>/libs/bullmq/src/$1',
    '^@app/database$': '<rootDir>/libs/database/src',
    '^@app/database/(.*)$': '<rootDir>/libs/database/src/$1',
  },
  setupFiles: ['reflect-metadata'],
  collectCoverageFrom: ['apps/**/*.ts', 'libs/**/*.ts'],
  testEnvironment: 'node',
};
export default config;
