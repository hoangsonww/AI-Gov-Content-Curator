import { Router } from "express";
import {
  handleOrchestratedChat,
  handleOrchestratedChatStream,
  handleArticleProcess,
  handleArticleAnalyze,
  handleBatchProcess,
  handleOrchestratorHealth,
  handleCostSnapshot,
  handleDeleteSession,
} from "../controllers/orchestrated-chat.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Orchestrator
 *     description: AI orchestration — chat (16 agents, dual LLM) and article processing (Python pipeline)
 */

/**
 * @swagger
 * /api/orchestrator/chat:
 *   post:
 *     tags: [Orchestrator]
 *     summary: Send a chat message through the AI orchestrator (non-streaming)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, message]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session identifier (client-generated UUID)
 *               message:
 *                 type: string
 *                 description: User message
 *               stream:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Orchestrated AI response with intent, agent, grounding metadata
 *       400:
 *         description: Validation error
 */
router.post("/chat", handleOrchestratedChat);

/**
 * @swagger
 * /api/orchestrator/chat/stream:
 *   post:
 *     tags: [Orchestrator]
 *     summary: Stream a chat response via Server-Sent Events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, message]
 *             properties:
 *               sessionId:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: SSE stream with chunks and completion event
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 */
router.post("/chat/stream", handleOrchestratedChatStream);

/**
 * @swagger
 * /api/orchestrator/process:
 *   post:
 *     tags: [Orchestrator]
 *     summary: Process an article through the Python LangGraph pipeline
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [article]
 *             properties:
 *               article:
 *                 type: object
 *                 required: [id, content]
 *                 properties:
 *                   id:
 *                     type: string
 *                   content:
 *                     type: string
 *                   url:
 *                     type: string
 *                   source:
 *                     type: string
 *                   title:
 *                     type: string
 *               mode:
 *                 type: string
 *                 enum: [full, fast, enrich, reprocess]
 *                 default: full
 *     responses:
 *       200:
 *         description: Pipeline processing result
 *       503:
 *         description: Python pipeline unavailable
 */
router.post("/process", handleArticleProcess);

/**
 * @swagger
 * /api/orchestrator/analyze:
 *   post:
 *     tags: [Orchestrator]
 *     summary: Run analysis agents on content without full pipeline
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *               analysis_type:
 *                 type: string
 *                 enum: [content, sentiment, classification, summary, quality, full]
 *                 default: full
 *     responses:
 *       200:
 *         description: Analysis results
 */
router.post("/analyze", handleArticleAnalyze);

/**
 * @swagger
 * /api/orchestrator/batch:
 *   post:
 *     tags: [Orchestrator]
 *     summary: Process multiple articles through the Python pipeline
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [articles]
 *             properties:
 *               articles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, content]
 *                   properties:
 *                     id:
 *                       type: string
 *                     content:
 *                       type: string
 *               mode:
 *                 type: string
 *                 enum: [full, fast, enrich, reprocess]
 *     responses:
 *       200:
 *         description: Batch processing results
 */
router.post("/batch", handleBatchProcess);

/**
 * @swagger
 * /api/orchestrator/health:
 *   get:
 *     tags: [Orchestrator]
 *     summary: Combined health check across chat orchestration and Python pipeline
 *     responses:
 *       200:
 *         description: Health status of both systems
 */
router.get("/health", handleOrchestratorHealth);

/**
 * @swagger
 * /api/orchestrator/cost:
 *   get:
 *     tags: [Orchestrator]
 *     summary: Current daily cost tracking snapshot
 *     responses:
 *       200:
 *         description: Cost breakdown by model and provider
 */
router.get("/cost", handleCostSnapshot);

/**
 * @swagger
 * /api/orchestrator/session/{sessionId}:
 *   delete:
 *     tags: [Orchestrator]
 *     summary: Delete a chat session and free its memory
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deletion status
 */
router.delete("/session/:sessionId", handleDeleteSession);

export default router;
