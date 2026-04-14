module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 60000,
  setupFiles: ["<rootDir>/src/__tests__/jest.setup.js"],
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: [
    "**/__tests__/**/*.spec.ts",
    "**/__tests__/**/*.spec.js",
    "**/?(*.)+(spec|test).[jt]s",
  ],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
