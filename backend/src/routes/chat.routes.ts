import { Router } from "express";
import { handleChat } from "../controllers/chat.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Q&A chat based on article context
 */

/**
 * @swagger
 * /api/chat:
 *   post:
 *     tags: [Chat]
 *     summary: Ask a question about the current article and receive an AI‑powered answer
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [article, userMessage, history]
 *             properties:
 *               article:
 *                 type: object
 *                 required: [title, content]
 *                 properties:
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *               userMessage:
 *                 type: string
 *                 description: Latest user question
 *               history:
 *                 type: array
 *                 description: Rolling chat history (max 10) that the frontend keeps
 *                 items:
 *                   type: object
 *                   required: [role, text]
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     text:
 *                       type: string
 *     responses:
 *       200:
 *         description: AI reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       400:
 *         description: Missing or invalid fields
 *       500:
 *         description: Server error
 */
router.post("/", handleChat);

export default router;
