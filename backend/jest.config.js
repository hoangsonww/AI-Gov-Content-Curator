module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 60000,
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: [
    "**/__tests__/**/*.spec.ts",
    "**/__tests__/**/*.spec.js",
    "**/?(*.)+(spec|test).[jt]s"
  ],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
