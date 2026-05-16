module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/src/**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/index.ts", // barrel re-export files carry no logic
    "!src/agents/types.ts", // type declarations only
  ],
  // Coverage gate: blocks regressions below the level the suite currently
  // sustains. Raise these as coverage improves; never lower them.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 68,
      functions: 80,
      lines: 80,
    },
  },
};
