module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  // `cookie@2` (pulled in by fastify's inject) ships ESM only; let ts-jest convert it.
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }] },
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/cookie@|cookie/)'],
  testEnvironment: 'node',
};
