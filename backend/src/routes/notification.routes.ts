import { Router } from "express";
import {
  processNotifications,
  processNotificationsByUrl,
  processDailyDigest,
} from "../controllers/notification.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Notification processing endpoints
 */

/**
 * @swagger
 * /api/notifications/process:
 *   post:
 *     tags: [Notifications]
 *     summary: Process notifications for a newly ingested article by ID
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: The ID of the newly ingested article
 *             required:
 *               - articleId
 *     responses:
 *       200:
 *         description: Notifications processed successfully
 *       400:
 *         description: Missing article ID
 *       404:
 *         description: Article not found
 *       500:
 *         description: Server error
 */
router.post("/process", processNotifications);

/**
 * @swagger
 * /api/notifications/process-by-url:
 *   post:
 *     tags: [Notifications]
 *     summary: Process notifications for a newly ingested article by URL
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The URL of the newly ingested article
 *             required:
 *               - url
 *     responses:
 *       200:
 *         description: Notifications processed successfully
 *       400:
 *         description: Missing article URL
 *       404:
 *         description: Article not found
 *       500:
 *         description: Server error
 */
router.post("/process-by-url", processNotificationsByUrl);

/**
 * @swagger
 * /api/notifications/daily-digest:
 *   post:
 *     tags: [Notifications]
 *     summary: Process daily digest notifications
 *     security:
 *       - ApiKeyAuth: []
 *     description: Processes daily digest notifications for users with daily subscription mode. Typically called by a cron job.
 *     responses:
 *       200:
 *         description: Daily digest processed successfully
 *       500:
 *         description: Server error
 */
router.post("/daily-digest", processDailyDigest);

export default router;