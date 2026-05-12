module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'util/**/*.js',
    '!util/email.js',
    '!util/cloudinary.js',
    '!util/file.js',
    '!scripts/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
