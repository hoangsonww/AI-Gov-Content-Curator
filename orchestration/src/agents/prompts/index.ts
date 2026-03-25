/**
 * Prompt registry with versioning and A/B metrics support.
 */

/** A registered prompt with versioning metadata. */
export interface PromptRecord {
  /** Unique prompt identifier. */
  id: string;
  /** Current version string (semver-like). */
  version: string;
  /** Prompt text content. */
  content: string;
  /** Historical versions keyed by version string. */
  history: Map<string, string>;
  /** Recorded usage metrics per version. */
  metrics: Map<string, PromptMetrics>;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

/** Performance metrics for a prompt version. */
export interface PromptMetrics {
  /** Number of times this prompt version was used. */
  usageCount: number;
  /** Average quality score from QA reviews (0-1). */
  averageQualityScore: number;
  /** Average user satisfaction (0-1). */
  averageSatisfaction: number;
  /** Number of times this version was rolled back from. */
  rollbackCount: number;
}

/**
 * Central registry for prompt versions with metrics-driven rollback support.
 */
export class PromptRegistry {
  private readonly registry: Map<string, PromptRecord> = new Map();

  /**
   * Register or update a prompt. If the prompt already exists at this version,
   * it is overwritten. If a new version is provided, the old version is archived.
   *
   * @param id - Unique prompt identifier.
   * @param version - Version string for this prompt.
   * @param content - Prompt text content.
   */
  register(id: string, version: string, content: string): void {
    const existing = this.registry.get(id);
    if (existing) {
      // Archive current version before updating
      existing.history.set(existing.version, existing.content);
      existing.version = version;
      existing.content = content;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.registry.set(id, {
        id,
        version,
        content,
        history: new Map(),
        metrics: new Map(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the latest version of a prompt.
   *
   * @param id - Prompt identifier.
   * @returns The current prompt content, or undefined if not found.
   */
  getLatest(id: string): string | undefined {
    return this.registry.get(id)?.content;
  }

  /**
   * Get a specific version of a prompt.
   *
   * @param id - Prompt identifier.
   * @param version - Version string to retrieve.
   * @returns The prompt content for that version, or undefined.
   */
  getVersion(id: string, version: string): string | undefined {
    const record = this.registry.get(id);
    if (!record) return undefined;
    if (record.version === version) return record.content;
    return record.history.get(version);
  }

  /**
   * Record performance metrics for a specific prompt version.
   *
   * @param id - Prompt identifier.
   * @param version - Version string these metrics apply to.
   * @param metrics - Partial metrics to merge into existing records.
   */
  recordMetrics(id: string, version: string, metrics: Partial<PromptMetrics>): void {
    const record = this.registry.get(id);
    if (!record) return;

    const existing = record.metrics.get(version) ?? {
      usageCount: 0,
      averageQualityScore: 0,
      averageSatisfaction: 0,
      rollbackCount: 0,
    };

    record.metrics.set(version, { ...existing, ...metrics });
  }

  /**
   * Roll back a prompt to a previously registered version.
   *
   * @param id - Prompt identifier.
   * @param targetVersion - The version to restore.
   * @returns true if rollback succeeded, false if version not found.
   */
  rollback(id: string, targetVersion: string): boolean {
    const record = this.registry.get(id);
    if (!record) return false;

    const historicContent = record.history.get(targetVersion);
    if (!historicContent) return false;

    // Archive current and restore historic
    record.history.set(record.version, record.content);
    record.version = targetVersion;
    record.content = historicContent;
    record.updatedAt = new Date().toISOString();

    // Increment rollback counter
    const metrics = record.metrics.get(targetVersion);
    if (metrics) {
      metrics.rollbackCount = (metrics.rollbackCount ?? 0) + 1;
    }

    return true;
  }

  /**
   * List all registered prompts with their current version and metadata.
   */
  listAll(): Array<{ id: string; version: string; updatedAt: string }> {
    return Array.from(this.registry.values()).map((r) => ({
      id: r.id,
      version: r.version,
      updatedAt: r.updatedAt,
    }));
  }
}

// Re-export system prompts
export { SUPERVISOR_SYSTEM_PROMPT } from './system/supervisor';
export { ARTICLE_SEARCH_SYSTEM_PROMPT } from './system/article-search';
export { ARTICLE_QA_SYSTEM_PROMPT } from './system/article-qa';
export { TOPIC_EXPLORER_SYSTEM_PROMPT } from './system/topic-explorer';
export { TREND_ANALYST_SYSTEM_PROMPT } from './system/trend-analyst';
export { BIAS_ANALYZER_SYSTEM_PROMPT } from './system/bias-analyzer';
export { CLARIFICATION_SYSTEM_PROMPT } from './system/clarification';
export { QUALITY_REVIEWER_SYSTEM_PROMPT } from './system/quality-reviewer';
export { GROUNDING_RULES, GroundingValidator } from './grounding';
export type { GroundingSource, GroundingValidationResult } from './grounding';
export { PromptCacheStrategy } from './cache-strategy';
export type { CacheLayer, CachedPrompt, CacheSavingsEstimate } from './cache-strategy';
