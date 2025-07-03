module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 60000,
  moduleFileExtensions: ["ts", "js", "json"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testMatch: ["**/__tests__/**/*.spec.(ts|js)"],
}
