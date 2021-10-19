module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 60000,
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}
