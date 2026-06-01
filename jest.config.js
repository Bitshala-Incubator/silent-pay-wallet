module.exports = {
  testEnvironment: '<rootDir>/src/tests/custom-environment.js',
  reporters: ['default', ['<rootDir>/src/tests/custom-reporter.js', {}]],
  preset: 'react-native',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community)?)|@rneui|silent-payments/|@react-navigation)',
  ],
  setupFiles: ['./src/tests/setup.js'],
  watchPathIgnorePatterns: ['<rootDir>/node_modules'],
};
