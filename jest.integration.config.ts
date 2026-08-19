import base from './jest.config';
export default { ...base, testRegex: '.*\\.integration-spec\\.ts$', testTimeout: 30000 };
