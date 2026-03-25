/**
 * Orchestrated chat controller.
 *
 * Routes chat and article-processing requests through the TypeScript
 * ChatSupervisor (dual-provider LLM, 16 agents, grounding, cost tracking)
 * and the Python AgenticPipeline (via PipelineClient HTTP bridge).
 *
 * Mounted at /api/orchestrator in app.ts.
 */

import { Request, Response, NextFunction } from "express";
import {
  ChatSupervisor,
  PipelineClient,
  chatRequestSchema,
  articleProcessRequestSchema,
  batchProcessRequestSchema,
} from "@synthoraai/orchestration";

// ---------------------------------------------------------------------------
// Singleton instances (created once, reused across requests)
// ---------------------------------------------------------------------------

let supervisor: ChatSupervisor | null = null;
let pipelineClient: PipelineClient | null = null;

function getSupervisor(): ChatSupervisor {
  if (!supervisor) {
    supervisor = new ChatSupervisor({
      dailyBudgetUsd: parseFloat(
        process.env.ORCHESTRATION_DAILY_BUDGET_USD || "10",
      ),
      maxHandoffDepth: parseInt(
        process.env.ORCHESTRATION_MAX_HANDOFF_DEPTH || "5",
        10,
      ),
      maxActiveMessages: parseInt(
        process.env.ORCHESTRATION_MAX_ACTIVE_MESSAGES || "20",
        10,
      ),
    });
  }
  return supervisor;
}

function getPipelineClient(): PipelineClient {
  if (!pipelineClient) {
    pipelineClient = new PipelineClient({
      baseUrl: process.env.PIPELINE_API_URL || "http://localhost:8100",
      timeoutMs: parseInt(process.env.PIPELINE_TIMEOUT_MS || "120000", 10),
    });
  }
  return pipelineClient;
}

// ---------------------------------------------------------------------------
// Chat endpoints (TypeScript orchestration)
// ---------------------------------------------------------------------------

/**
 * POST /api/orchestrator/chat
 * Non-streaming chat through ChatSupervisor.
 */
export async function handleOrchestratedChat(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId, message } = parsed.data;
    const sv = getSupervisor();
    const result = await sv.chat(sessionId, message);

    return res.json({
      content: result.content,
      sessionId: result.sessionId,
      intent: result.intent,
      agentId: result.agentId,
      metadata: {
        model: result.metadata.model,
        provider: result.metadata.provider,
        latencyMs: result.metadata.latencyMs,
        inputTokens: result.metadata.inputTokens,
        outputTokens: result.metadata.outputTokens,
        estimatedCost: result.metadata.estimatedCost,
      },
      grounding: result.grounding,
      handoffChain: result.handoffChain,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orchestrator/chat/stream
 * Streaming (SSE) chat through ChatSupervisor.
 */
export async function handleOrchestratedChatStream(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId, message } = parsed.data;
    const sv = getSupervisor();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent("status", { message: "Routing to agent..." });

      for await (const chunk of sv.chatStream(sessionId, message)) {
        if (chunk.delta) {
          sendEvent("chunk", { text: chunk.delta, agentId: chunk.agentId });
        }
        if (chunk.done) {
          sendEvent("done", {
            success: true,
            agentId: chunk.agentId,
            usage: chunk.usage,
          });
        }
      }
    } catch (streamErr) {
      console.error("Orchestrated stream error:", streamErr);
      sendEvent("chunk", {
        text: "I encountered an error processing this request. Please try again.",
      });
      sendEvent("done", { success: false });
    } finally {
      res.end();
    }
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Article processing endpoints (Python pipeline via HTTP bridge)
// ---------------------------------------------------------------------------

/**
 * POST /api/orchestrator/process
 * Process a single article through the Python LangGraph pipeline.
 */
export async function handleArticleProcess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = articleProcessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const client = getPipelineClient();
    const result = await client.processArticle({
      article: {
        article_id: parsed.data.article.id,
        content: parsed.data.article.content,
        url: parsed.data.article.url,
        source: parsed.data.article.source,
        title: parsed.data.article.title,
      },
      mode: parsed.data.mode,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orchestrator/analyze
 * Run analysis agents on content without full pipeline processing.
 */
export async function handleArticleAnalyze(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { content, analysis_type = "full" } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "`content` string is required" });
    }

    const client = getPipelineClient();
    const result = await client.analyzeContent({ content, analysis_type });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orchestrator/batch
 * Process multiple articles through the Python pipeline.
 */
export async function handleBatchProcess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = batchProcessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const client = getPipelineClient();
    const result = await client.processBatch({
      articles: parsed.data.articles.map((a) => ({
        article_id: a.id,
        content: a.content,
        url: a.url,
        source: a.source,
        title: a.title,
      })),
      mode: parsed.data.mode,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Health / status endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/orchestrator/health
 * Combined health check across both orchestration layers.
 */
export async function handleOrchestratorHealth(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sv = getSupervisor();
    const client = getPipelineClient();

    const [chatHealth, pipelineAvailable] = await Promise.all([
      Promise.resolve(sv.healthCheck()),
      client.isAvailable().catch(() => false),
    ]);

    const overallStatus =
      chatHealth.status === "unhealthy" && !pipelineAvailable
        ? "unhealthy"
        : chatHealth.status === "unhealthy" || !pipelineAvailable
          ? "degraded"
          : chatHealth.status;

    return res.json({
      status: overallStatus,
      chat: chatHealth,
      pipeline: {
        available: pipelineAvailable,
        url: process.env.PIPELINE_API_URL || "http://localhost:8100",
      },
      uptime: process.uptime(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orchestrator/cost
 * Current cost tracking snapshot.
 */
export async function handleCostSnapshot(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sv = getSupervisor();
    return res.json(sv.getCostSnapshot());
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/orchestrator/session/:sessionId
 * Delete a chat session.
 */
export async function handleDeleteSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId param required" });
    }
    const sv = getSupervisor();
    const deleted = sv.deleteSession(sessionId);
    return res.json({ deleted });
  } catch (err) {
    next(err);
  }
}
