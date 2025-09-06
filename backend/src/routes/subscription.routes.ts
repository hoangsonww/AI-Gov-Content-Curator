import { Router } from "express";
import {
  getUserSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscription,
} from "../controllers/subscription.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Subscriptions
 *     description: User subscription management for real-time notifications
 */

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get all subscriptions for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscription'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authenticate, getUserSubscriptions);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Create a new subscription
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of topics to subscribe to
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of keywords to monitor
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of sources to subscribe to
 *               mode:
 *                 type: string
 *                 enum: ['realtime', 'daily']
 *                 description: Notification delivery mode
 *               emailEnabled:
 *                 type: boolean
 *                 description: Enable email notifications
 *               pushEnabled:
 *                 type: boolean
 *                 description: Enable push notifications
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", authenticate, createSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get a specific subscription by ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.get("/:id", authenticate, getSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   put:
 *     tags: [Subscriptions]
 *     summary: Update a subscription
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of topics to subscribe to
 *               keywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of keywords to monitor
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of sources to subscribe to
 *               mode:
 *                 type: string
 *                 enum: ['realtime', 'daily']
 *                 description: Notification delivery mode
 *               emailEnabled:
 *                 type: boolean
 *                 description: Enable email notifications
 *               pushEnabled:
 *                 type: boolean
 *                 description: Enable push notifications
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.put("/:id", authenticate, updateSubscription);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   delete:
 *     tags: [Subscriptions]
 *     summary: Delete a subscription
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", authenticate, deleteSubscription);

export default router;