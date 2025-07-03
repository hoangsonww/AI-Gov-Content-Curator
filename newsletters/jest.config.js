module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/__tests__/**/*.spec.ts", "**/__tests__/**/*.spec.js"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  globals: {},
};
