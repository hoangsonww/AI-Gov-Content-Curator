/**
 * Tests for orchestration environment validation and preflight checks.
 */

import {
  loadOrchestrationEnv,
  tryLoadOrchestrationEnv,
  preflightCheck,
} from "../config/environment";

describe("loadOrchestrationEnv", () => {
  it("applies documented defaults when env is empty", () => {
    const env = loadOrchestrationEnv({});
    expect(env.ORCHESTRATION_DAILY_BUDGET_USD).toBe(10);
    expect(env.ORCHESTRATION_MAX_CONCURRENCY).toBe(5);
    expect(env.ORCHESTRATION_TIMEOUT_MS).toBe(60000);
    expect(env.ORCHESTRATION_MAX_HANDOFF_DEPTH).toBe(5);
    expect(env.ORCHESTRATION_LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces numeric strings to numbers", () => {
    const env = loadOrchestrationEnv({
      ORCHESTRATION_DAILY_BUDGET_USD: "25",
      ORCHESTRATION_MAX_CONCURRENCY: "12",
    });
    expect(env.ORCHESTRATION_DAILY_BUDGET_USD).toBe(25);
    expect(env.ORCHESTRATION_MAX_CONCURRENCY).toBe(12);
  });

  it("passes through provider keys when set", () => {
    const env = loadOrchestrationEnv({
      ANTHROPIC_API_KEY: "ant-key",
      GOOGLE_API_KEY: "goog-key",
    });
    expect(env.ANTHROPIC_API_KEY).toBe("ant-key");
    expect(env.GOOGLE_API_KEY).toBe("goog-key");
  });

  it("throws on a non-positive budget", () => {
    expect(() =>
      loadOrchestrationEnv({ ORCHESTRATION_DAILY_BUDGET_USD: "0" }),
    ).toThrow();
  });

  it("throws on a non-integer concurrency", () => {
    expect(() =>
      loadOrchestrationEnv({ ORCHESTRATION_MAX_CONCURRENCY: "2.5" }),
    ).toThrow();
  });

  it("throws on an out-of-range handoff depth", () => {
    expect(() =>
      loadOrchestrationEnv({ ORCHESTRATION_MAX_HANDOFF_DEPTH: "50" }),
    ).toThrow();
  });

  it("rejects an invalid log level", () => {
    expect(() =>
      loadOrchestrationEnv({ ORCHESTRATION_LOG_LEVEL: "verbose" }),
    ).toThrow();
  });
});

describe("tryLoadOrchestrationEnv", () => {
  it("returns success with parsed data for a valid env", () => {
    const result = tryLoadOrchestrationEnv({ ANTHROPIC_API_KEY: "k" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBe("k");
    }
  });

  it("returns structured errors for an invalid env", () => {
    const result = tryLoadOrchestrationEnv({
      ORCHESTRATION_TIMEOUT_MS: "-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("ORCHESTRATION_TIMEOUT_MS"))).toBe(true);
    }
  });

  it("does not throw on malformed input", () => {
    expect(() => tryLoadOrchestrationEnv({ NODE_ENV: "bogus" })).not.toThrow();
  });
});

describe("preflightCheck", () => {
  it("is ready and warns about failover with both providers", () => {
    const env = loadOrchestrationEnv({
      ANTHROPIC_API_KEY: "a",
      GOOGLE_API_KEY: "g",
    });
    const report = preflightCheck(env);
    expect(report.ready).toBe(true);
    expect(report.providers).toEqual(["anthropic", "google"]);
    expect(report.warnings).toHaveLength(0);
  });

  it("is ready but warns when only one provider is configured", () => {
    const env = loadOrchestrationEnv({ ANTHROPIC_API_KEY: "a" });
    const report = preflightCheck(env);
    expect(report.ready).toBe(true);
    expect(report.providers).toEqual(["anthropic"]);
    expect(report.warnings.some((w) => w.includes("failover is disabled"))).toBe(true);
  });

  it("is not ready and flags a critical warning with no providers", () => {
    const env = loadOrchestrationEnv({});
    const report = preflightCheck(env);
    expect(report.ready).toBe(false);
    expect(report.providers).toHaveLength(0);
    expect(report.warnings.some((w) => w.startsWith("CRITICAL"))).toBe(true);
  });
});
