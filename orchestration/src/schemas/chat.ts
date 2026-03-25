/**
 * Zod schemas for chat API request/response validation.
 *
 * Used at the boundary between the Express backend and the orchestration
 * layer to guarantee runtime type safety.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

/** Schema for incoming chat message requests. */
export const chatRequestSchema = z.object({
  /** Session identifier (UUIDv4 or client-generated ID). */
  sessionId: z.string().min(1).max(128),
  /** User message content. */
  message: z.string().min(1).max(32_000),
  /** Whether to stream the response via SSE. */
  stream: z.boolean().optional().default(false),
  /** Optional processing mode override. */
  mode: z.enum(['DIRECT', 'TOOL_AUGMENTED', 'AGENTIC']).optional(),
  /** Optional metadata from the client. */
  metadata: z.record(z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Schema for article processing requests (batch endpoint). */
export const articleProcessRequestSchema = z.object({
  /** Article payload. */
  article: z.object({
    id: z.string().min(1),
    content: z.string().min(1),
    url: z.string().url().optional(),
    source: z.string().optional(),
    title: z.string().optional(),
  }),
  /** Processing mode. */
  mode: z.enum(['full', 'fast', 'enrich', 'reprocess']).default('full'),
  /** Priority for batch ordering (higher = sooner). */
  priority: z.number().int().min(0).max(100).default(0),
});

export type ArticleProcessRequest = z.infer<typeof articleProcessRequestSchema>;

/** Schema for batch processing requests. */
export const batchProcessRequestSchema = z.object({
  articles: z.array(articleProcessRequestSchema.shape.article).min(1).max(100),
  mode: z.enum(['full', 'fast', 'enrich', 'reprocess']).default('full'),
});

export type BatchProcessRequest = z.infer<typeof batchProcessRequestSchema>;

// ---------------------------------------------------------------------------
// Response schemas (for documentation / contract testing)
// ---------------------------------------------------------------------------

export const chatResponseSchema = z.object({
  content: z.string(),
  sessionId: z.string(),
  intent: z.object({
    query: z.string(),
    intent: z.string(),
    entities: z.array(z.string()),
    confidence: z.number(),
  }),
  agentId: z.string(),
  metadata: z.object({
    agentId: z.string(),
    model: z.string(),
    provider: z.string(),
    timestamp: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    latencyMs: z.number(),
    retryCount: z.number(),
    estimatedCost: z.number(),
  }),
  grounding: z.object({
    valid: z.boolean(),
    warnings: z.array(z.string()),
    score: z.number(),
  }),
  handoffChain: z.array(z.string()),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

/** Health check response schema. */
export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  providers: z.array(z.string()),
  warnings: z.array(z.string()),
  budget: z.object({
    totalUsd: z.number(),
    remainingUsd: z.number(),
    budgetUsd: z.number(),
  }),
  uptime: z.number(),
});

export type HealthCheckResponse = z.infer<typeof healthCheckSchema>;
