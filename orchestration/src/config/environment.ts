/**
 * Runtime configuration with Zod validation.
 *
 * Validates environment variables at startup so the orchestration layer
 * fails fast with actionable messages instead of mysterious SDK errors.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const orchestrationEnvSchema = z.object({
  /** Anthropic API key (required for Anthropic-backed agents). */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  /** Google AI API key (required for Google-backed agents). */
  GOOGLE_API_KEY: z.string().min(1).optional(),

  /** Daily cost budget cap in USD (default "10"). */
  ORCHESTRATION_DAILY_BUDGET_USD: z
    .string()
    .default('10')
    .transform(Number)
    .pipe(z.number().positive()),

  /** Maximum concurrent LLM requests (default "5"). */
  ORCHESTRATION_MAX_CONCURRENCY: z
    .string()
    .default('5')
    .transform(Number)
    .pipe(z.number().int().positive()),

  /** Default request timeout in milliseconds (default "60000"). */
  ORCHESTRATION_TIMEOUT_MS: z
    .string()
    .default('60000')
    .transform(Number)
    .pipe(z.number().int().positive()),

  /** Maximum handoff chain depth (default "5"). */
  ORCHESTRATION_MAX_HANDOFF_DEPTH: z
    .string()
    .default('5')
    .transform(Number)
    .pipe(z.number().int().positive().max(20)),

  /** Max active messages per session before compaction (default "20"). */
  ORCHESTRATION_MAX_ACTIVE_MESSAGES: z
    .string()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().positive()),

  /** Log level for structured logging (default "info"). */
  ORCHESTRATION_LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  /** Node environment. */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type OrchestrationEnv = z.infer<typeof orchestrationEnvSchema>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate and return typed environment configuration.
 * Throws a descriptive ZodError if required variables are missing or malformed.
 */
export function loadOrchestrationEnv(
  env: Record<string, string | undefined> = process.env
): OrchestrationEnv {
  return orchestrationEnvSchema.parse(env);
}

/**
 * Safe variant that returns a result object instead of throwing.
 */
export function tryLoadOrchestrationEnv(
  env: Record<string, string | undefined> = process.env
): { success: true; data: OrchestrationEnv } | { success: false; errors: string[] } {
  const result = orchestrationEnvSchema.safeParse(env);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  );
  return { success: false, errors };
}

// ---------------------------------------------------------------------------
// Preflight check
// ---------------------------------------------------------------------------

/**
 * Run a preflight check that verifies at least one LLM provider is configured.
 * Returns a diagnostic report suitable for health-check endpoints.
 */
export function preflightCheck(
  env: OrchestrationEnv
): { ready: boolean; providers: string[]; warnings: string[] } {
  const providers: string[] = [];
  const warnings: string[] = [];

  if (env.ANTHROPIC_API_KEY) {
    providers.push('anthropic');
  } else {
    warnings.push('ANTHROPIC_API_KEY not set — Anthropic agents will be unavailable');
  }

  if (env.GOOGLE_API_KEY) {
    providers.push('google');
  } else {
    warnings.push('GOOGLE_API_KEY not set — Google agents will be unavailable');
  }

  if (providers.length === 0) {
    warnings.push('CRITICAL: No LLM provider configured — all generation calls will fail');
  }

  if (providers.length === 1) {
    warnings.push(
      `Only ${providers[0]} is configured — provider failover is disabled`
    );
  }

  return {
    ready: providers.length > 0,
    providers,
    warnings,
  };
}
