import { Router } from "express";
import {
  listFlags,
  getFlag,
  createFlag,
  updateFlag,
  deleteFlag,
  evaluateFlags,
} from "../controllers/featureFlag.controller";
import { authenticate, optionalAuthenticate } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/requireAdmin.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Feature Flags
 *     description: In-house feature-flag and progressive-rollout framework
 */

/**
 * @swagger
 * /api/flags/evaluate:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Evaluate feature flags for the current caller
 *     description: >
 *       Works for both authenticated and anonymous callers. Pass the
 *       x-anonymous-id header (or ?anonId=) for logged-out identity.
 *       Optional ?keys=a,b,c limits the response to specific flags.
 *     responses:
 *       200:
 *         description: Map of flag key to boolean
 *       503:
 *         description: Flag evaluation failed (e.g. database unavailable)
 */
router.get("/evaluate", optionalAuthenticate, evaluateFlags);

/**
 * @swagger
 * /api/flags:
 *   get:
 *     tags: [Feature Flags]
 *     summary: List all feature flags (admin only)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Array of feature flags
 *       403:
 *         description: Admin access required
 */
router.get("/", authenticate, requireAdmin, listFlags);

/**
 * @swagger
 * /api/flags/{key}:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Get a single feature flag by key (admin only)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The feature flag
 *       404:
 *         description: Flag not found
 */
router.get("/:key", authenticate, requireAdmin, getFlag);

/**
 * @swagger
 * /api/flags:
 *   post:
 *     tags: [Feature Flags]
 *     summary: Create a new feature flag (admin only)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeatureFlag'
 *     responses:
 *       201:
 *         description: Flag created
 *       409:
 *         description: A flag with this key already exists
 */
router.post("/", authenticate, requireAdmin, createFlag);

/**
 * @swagger
 * /api/flags/{key}:
 *   put:
 *     tags: [Feature Flags]
 *     summary: Update a feature flag (admin only)
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flag updated
 *       404:
 *         description: Flag not found
 */
router.put("/:key", authenticate, requireAdmin, updateFlag);

/**
 * @swagger
 * /api/flags/{key}:
 *   delete:
 *     tags: [Feature Flags]
 *     summary: Delete a feature flag (admin only)
 *     description: >
 *       Baseline flags (self-seeded at startup) cannot be deleted — set
 *       enabled=false instead, or they will be silently recreated as
 *       enabled=true on the next server restart.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flag deleted
 *       400:
 *         description: Cannot delete a baseline flag
 *       404:
 *         description: Flag not found
 */
router.delete("/:key", authenticate, requireAdmin, deleteFlag);

export default router;
