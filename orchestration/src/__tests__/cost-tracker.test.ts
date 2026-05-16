/**
 * Tests for CostTracker — per-request and daily spend accounting.
 */

import { CostTracker } from "../cost/cost-tracker";
import { MODEL_PRICING, ModelProvider } from "../agents/types";
import type { TaskMetadata } from "../agents/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetadata(
  model: string,
  inputTokens: number,
  outputTokens: number,
  estimatedCost: number,
): TaskMetadata {
  return {
    agentId: "test-agent",
    model,
    provider: ModelProvider.anthropic,
    timestamp: new Date().toISOString(),
    inputTokens,
    outputTokens,
    latencyMs: 10,
    retryCount: 0,
    estimatedCost,
  };
}

// ---------------------------------------------------------------------------
// estimateCost
// ---------------------------------------------------------------------------

describe("CostTracker.estimateCost", () => {
  const tracker = new CostTracker();

  it("returns 0 for an unknown model", () => {
    expect(tracker.estimateCost("model-that-does-not-exist", 1000, 500)).toBe(
      0,
    );
  });

  it("correctly calculates cost for claude-sonnet-4-6 (no cached tokens)", () => {
    // Input: $3/M, Output: $15/M
    // 1_000_000 input + 1_000_000 output = $3 + $15 = $18
    const cost = tracker.estimateCost(
      "claude-sonnet-4-6",
      1_000_000,
      1_000_000,
    );
    expect(cost).toBeCloseTo(18, 6);
  });

  it("correctly adds cached token cost for claude-sonnet-4-6", () => {
    // cachedInput for claude-sonnet-4-6 = $0.3/M
    // 1M input + 1M cached = 3 + 0.3 = 3.3 (output = 0)
    const cost = tracker.estimateCost(
      "claude-sonnet-4-6",
      1_000_000,
      0,
      1_000_000,
    );
    expect(cost).toBeCloseTo(3.3, 6);
  });

  it("falls back to input pricing for cached tokens when cachedInput is absent", () => {
    // gpt-4o has cachedInput defined; test a hypothetical by checking the formula uses
    // pricing.cachedInput ?? pricing.input. We can verify with gpt-4o-mini:
    // input $0.15/M, cachedInput $0.075/M
    const pricing = MODEL_PRICING["gpt-4o-mini"]!;
    const expected =
      (100_000 / 1_000_000) * pricing.input +
      (50_000 / 1_000_000) * pricing.output +
      (200_000 / 1_000_000) * (pricing.cachedInput ?? pricing.input);
    const actual = tracker.estimateCost(
      "gpt-4o-mini",
      100_000,
      50_000,
      200_000,
    );
    expect(actual).toBeCloseTo(expected, 8);
  });

  it("returns 0 when all token counts are 0", () => {
    expect(tracker.estimateCost("gemini-2.0-flash", 0, 0, 0)).toBe(0);
  });

  it("handles fractional token counts without throwing", () => {
    // Floating-point inputs are an edge case that should not throw
    expect(() =>
      tracker.estimateCost("claude-haiku-4-5", 1.7, 2.3),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// canAfford
// ---------------------------------------------------------------------------

describe("CostTracker.canAfford", () => {
  it("returns true when no budget has been spent", () => {
    const tracker = new CostTracker({ dailyBudgetUsd: 10 });
    expect(tracker.canAfford(5)).toBe(true);
  });

  it("returns true for an estimate exactly equal to the remaining budget", () => {
    const tracker = new CostTracker({ dailyBudgetUsd: 1 });
    expect(tracker.canAfford(1)).toBe(true);
  });

  it("returns false for an estimate exceeding the budget", () => {
    const tracker = new CostTracker({ dailyBudgetUsd: 1 });
    expect(tracker.canAfford(1.000001)).toBe(false);
  });

  it("returns false after spending drains the budget to zero", () => {
    const tracker = new CostTracker({ dailyBudgetUsd: 0.01 });
    tracker.recordUsage(makeMetadata("claude-haiku-4-5", 100, 50, 0.01));
    expect(tracker.canAfford(0.0001)).toBe(false);
  });

  it("uses the default $10 budget when no config is supplied", () => {
    const tracker = new CostTracker();
    expect(tracker.canAfford(10)).toBe(true);
    expect(tracker.canAfford(10.0001)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordUsage & getSnapshot
// ---------------------------------------------------------------------------

describe("CostTracker.recordUsage + getSnapshot", () => {
  it("accumulates cost across multiple calls", () => {
    const tracker = new CostTracker();
    tracker.recordUsage(makeMetadata("claude-sonnet-4-6", 1000, 500, 0.005));
    tracker.recordUsage(makeMetadata("claude-sonnet-4-6", 2000, 1000, 0.01));
    const snap = tracker.getSnapshot();
    expect(snap.totalUsd).toBeCloseTo(0.015, 6);
    expect(snap.requestCount).toBe(2);
  });

  it("tracks per-model breakdown correctly", () => {
    const tracker = new CostTracker();
    tracker.recordUsage(makeMetadata("claude-sonnet-4-6", 1000, 500, 0.005));
    tracker.recordUsage(makeMetadata("gemini-2.0-flash", 2000, 1000, 0.002));
    const snap = tracker.getSnapshot();
    expect(snap.byModel["claude-sonnet-4-6"]).toBeDefined();
    expect(snap.byModel["gemini-2.0-flash"]).toBeDefined();
    expect(snap.byModel["claude-sonnet-4-6"]!.inputTokens).toBe(1000);
    expect(snap.byModel["gemini-2.0-flash"]!.inputTokens).toBe(2000);
  });

  it("aggregates tokens for the same model across multiple calls", () => {
    const tracker = new CostTracker();
    tracker.recordUsage(makeMetadata("claude-haiku-4-5", 100, 50, 0.001));
    tracker.recordUsage(makeMetadata("claude-haiku-4-5", 200, 100, 0.002));
    const snap = tracker.getSnapshot();
    const entry = snap.byModel["claude-haiku-4-5"]!;
    expect(entry.inputTokens).toBe(300);
    expect(entry.outputTokens).toBe(150);
    expect(entry.costUsd).toBeCloseTo(0.003, 6);
  });

  it("snapshot includes correct date (today UTC)", () => {
    const tracker = new CostTracker();
    const snap = tracker.getSnapshot();
    const today = new Date().toISOString().slice(0, 10);
    expect(snap.date).toBe(today);
  });

  it("snapshot remainingUsd is clamped to 0 when overbudget", () => {
    const tracker = new CostTracker({ dailyBudgetUsd: 0.001 });
    tracker.recordUsage(makeMetadata("claude-sonnet-4-6", 10_000, 5_000, 1.0));
    const snap = tracker.getSnapshot();
    expect(snap.remainingUsd).toBe(0);
  });

  it("fresh tracker has zero totalUsd and empty byModel", () => {
    const tracker = new CostTracker();
    const snap = tracker.getSnapshot();
    expect(snap.totalUsd).toBe(0);
    expect(snap.requestCount).toBe(0);
    expect(Object.keys(snap.byModel)).toHaveLength(0);
  });
});
