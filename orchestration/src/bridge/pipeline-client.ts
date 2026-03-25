/**
 * HTTP client for the Python AgenticPipeline API.
 *
 * Allows the TypeScript orchestration layer to call the Python LangGraph
 * pipeline for article processing, analysis, and batch operations.
 *
 * The Python side is served by `agentic_ai/api.py` (FastAPI on port 8100).
 */

import { createLogger } from "../observability/logger";

const logger = createLogger("bridge.pipeline-client");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface PipelineClientConfig {
  /** Base URL of the Python pipeline API. Default: http://localhost:8100 */
  baseUrl?: string;
  /** Request timeout in ms. Default: 120_000 (2 min) */
  timeoutMs?: number;
  /** Number of retry attempts for transient failures. Default: 2 */
  retries?: number;
}

// ---------------------------------------------------------------------------
// Request / response types (mirror the Python Pydantic models)
// ---------------------------------------------------------------------------

export interface ArticlePayload {
  article_id: string;
  content: string;
  url?: string;
  source?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessRequest {
  article: ArticlePayload;
  mode?: "full" | "fast" | "enrich" | "reprocess";
}

export interface AnalyzeRequest {
  content: string;
  analysis_type?:
    | "content"
    | "sentiment"
    | "classification"
    | "summary"
    | "quality"
    | "full";
}

export interface BatchRequest {
  articles: ArticlePayload[];
  mode?: "full" | "fast" | "enrich" | "reprocess";
  continue_on_error?: boolean;
}

export interface ProcessResult {
  article_id: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

export interface AnalyzeResult {
  status: string;
  analysis_type: string;
  content_analysis?: Record<string, unknown>;
  sentiment?: Record<string, unknown>;
  classification?: unknown;
  summary?: string;
  quality?: Record<string, unknown>;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  duration_ms: number;
  results: ProcessResult[];
}

export interface PipelineHealth {
  status: "healthy" | "degraded" | "unhealthy";
  pipeline_ready: boolean;
  startup_error?: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class PipelineClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(config: PipelineClientConfig = {}) {
    this.baseUrl = (
      config.baseUrl ??
      process.env.PIPELINE_API_URL ??
      "http://localhost:8100"
    ).replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? 120_000;
    this.retries = config.retries ?? 2;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Process a single article through the LangGraph pipeline. */
  async processArticle(req: ProcessRequest): Promise<ProcessResult> {
    return this.post<ProcessResult>("/process", req);
  }

  /** Run individual analysis agents on content. */
  async analyzeContent(req: AnalyzeRequest): Promise<AnalyzeResult> {
    return this.post<AnalyzeResult>("/analyze", req);
  }

  /** Process a batch of articles concurrently. */
  async processBatch(req: BatchRequest): Promise<BatchResult> {
    return this.post<BatchResult>("/batch", req);
  }

  /** Check Python pipeline health. */
  async health(): Promise<PipelineHealth> {
    return this.get<PipelineHealth>("/health");
  }

  /** True if the pipeline API is reachable and healthy. */
  async isAvailable(): Promise<boolean> {
    try {
      const h = await this.health();
      return h.pipeline_ready;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 1,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const err = new Error(
          `Pipeline API ${method} ${path} returned ${res.status}: ${detail}`,
        );
        // Retry on 502/503/504
        if (attempt <= this.retries && res.status >= 502 && res.status <= 504) {
          logger.warn("pipeline_client.retry", {
            method,
            path,
            status: res.status,
            attempt,
          });
          await this.backoff(attempt);
          return this.request<T>(method, path, body, attempt + 1);
        }
        throw err;
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `Pipeline API ${method} ${path} timed out after ${this.timeoutMs}ms`,
        );
      }
      // Retry on network errors
      if (attempt <= this.retries && this.isNetworkError(err)) {
        logger.warn("pipeline_client.retry_network", {
          method,
          path,
          attempt,
          error: String(err),
        });
        await this.backoff(attempt);
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private isNetworkError(err: unknown): boolean {
    if (err instanceof TypeError) return true; // fetch network error
    const msg = err instanceof Error ? err.message : "";
    return /ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up/i.test(msg);
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(1000 * 2 ** (attempt - 1), 10_000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
