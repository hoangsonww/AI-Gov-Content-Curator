import { Router } from "express";
import { subscribe, unsubscribe } from "../controllers/newsletter.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Newsletter
 *     description: E‑mail newsletter subscription
 */

/**
 * @swagger
 * /api/newsletter/subscribe:
 *   post:
 *     tags: [Newsletter]
 *     summary: Subscribe an e‑mail address to the newsletter
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Valid e‑mail address
 *     responses:
 *       201:
 *         description: Subscription successful.
 *       200:
 *         description: Address was already subscribed.
 *       400:
 *         description: Invalid e‑mail address.
 *       500:
 *         description: Server error.
 */
router.post("/subscribe", subscribe);

/**
 * @swagger
 * /api/newsletter/unsubscribe:
 *   post:
 *     tags: [Newsletter]
 *     summary: Unsubscribe an e‑mail address from the newsletter
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Valid e‑mail address
 *     responses:
 *       200:
 *         description: Unsubscribed successfully.
 *       400:
 *         description: Invalid e‑mail address.
 *       404:
 *         description: Address was not subscribed.
 *       500:
 *         description: Server error.
 *
 *   get:
 *     tags: [Newsletter]
 *     summary: One‑click unsubscribe via query parameter
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: The e‑mail address to unsubscribe.
 *     responses:
 *       200:
 *         description: Unsubscribed successfully.
 *       400:
 *         description: Invalid e‑mail address.
 *       404:
 *         description: Address was not subscribed.
 *       500:
 *         description: Server error.
 */
router.post("/unsubscribe", unsubscribe);
router.get("/unsubscribe", unsubscribe);

export default router;
