/**
 * Per-request and daily cost tracker for the orchestration layer.
 *
 * Uses the MODEL_PRICING table from types.ts and enforces a configurable
 * daily budget cap. Thread-safe for single-process Node.js usage.
 */

import { MODEL_PRICING, type TaskMetadata } from '../agents/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CostTrackerConfig {
  /** Daily spend cap in USD (default $10). */
  dailyBudgetUsd?: number;
}

/** Snapshot of current daily usage. */
export interface DailyUsageSnapshot {
  /** UTC date string (YYYY-MM-DD). */
  date: string;
  /** Total spend so far today in USD. */
  totalUsd: number;
  /** Daily budget cap in USD. */
  budgetUsd: number;
  /** Remaining allowance in USD. */
  remainingUsd: number;
  /** Per-model breakdown. */
  byModel: Record<string, { costUsd: number; inputTokens: number; outputTokens: number }>;
  /** Total requests tracked today. */
  requestCount: number;
}

// ---------------------------------------------------------------------------
// Tracker
// ---------------------------------------------------------------------------

const DEFAULT_DAILY_BUDGET = 10.0;

export class CostTracker {
  private readonly dailyBudgetUsd: number;
  private currentDate: string;
  private totalUsd = 0;
  private requestCount = 0;
  private byModel: Map<string, { costUsd: number; inputTokens: number; outputTokens: number }> =
    new Map();

  constructor(config: CostTrackerConfig = {}) {
    this.dailyBudgetUsd = config.dailyBudgetUsd ?? DEFAULT_DAILY_BUDGET;
    this.currentDate = this.todayUtc();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Estimate the cost for a model call before execution.
   * Returns 0 for unknown models.
   */
  estimateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens = 0
  ): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) return 0;

    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      (cachedTokens / 1_000_000) * (pricing.cachedInput ?? pricing.input)
    );
  }

  /** Check whether a given estimated cost fits within the remaining daily budget. */
  canAfford(estimatedCostUsd: number): boolean {
    this.maybeReset();
    return estimatedCostUsd <= this.dailyBudgetUsd - this.totalUsd;
  }

  /** Record actual usage from a completed LLM call. */
  recordUsage(metadata: TaskMetadata): void {
    this.maybeReset();

    this.totalUsd += metadata.estimatedCost;
    this.requestCount++;

    const existing = this.byModel.get(metadata.model) ?? {
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    existing.costUsd += metadata.estimatedCost;
    existing.inputTokens += metadata.inputTokens;
    existing.outputTokens += metadata.outputTokens;
    this.byModel.set(metadata.model, existing);
  }

  /** Return a snapshot of today's usage. */
  getSnapshot(): DailyUsageSnapshot {
    this.maybeReset();

    const byModelObj: DailyUsageSnapshot['byModel'] = {};
    for (const [model, data] of this.byModel) {
      byModelObj[model] = { ...data };
    }

    return {
      date: this.currentDate,
      totalUsd: Math.round(this.totalUsd * 1_000_000) / 1_000_000,
      budgetUsd: this.dailyBudgetUsd,
      remainingUsd:
        Math.round(Math.max(0, this.dailyBudgetUsd - this.totalUsd) * 1_000_000) / 1_000_000,
      byModel: byModelObj,
      requestCount: this.requestCount,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private maybeReset(): void {
    const today = this.todayUtc();
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.totalUsd = 0;
      this.requestCount = 0;
      this.byModel.clear();
    }
  }
}
