import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  exportUserData,
  requestAccountDeletion,
  cancelAccountDeletion,
  confirmDeleteAccount,
} from "../controllers/privacy.controller";
import { authenticate } from "../middleware/auth.middleware";

// 3 requests per hour per authenticated user.
// Must be placed after authenticate so req.user.id is available.
const deletionRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => (req as any).user?.id ?? req.ip,
  handler: (_req, res) =>
    res.status(429).json({
      error: "Too many deletion requests. Please try again in an hour.",
    }),
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Privacy
 *     description: User data export and account deletion (GDPR-style controls)
 */

/**
 * @swagger
 * /api/privacy/export:
 *   get:
 *     tags: [Privacy]
 *     summary: Export all personal data for the authenticated user
 *     description: >
 *       Returns a JSON file attachment containing the user's profile, favourites,
 *       comments, ratings, passkey metadata, and newsletter subscription.
 *       Password hashes and raw public keys are excluded.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: JSON data export file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/export", authenticate, exportUserData);

/**
 * @swagger
 * /api/privacy/request-deletion:
 *   post:
 *     tags: [Privacy]
 *     summary: Request account deletion — issues a short-lived confirmation token
 *     description: >
 *       Generates a deletion token valid for 1 hour.
 *       Pass the token to DELETE /api/privacy/account to complete the deletion.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Confirmation code emailed to the registered address
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: Unauthenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/request-deletion",
  authenticate,
  deletionRequestLimiter,
  requestAccountDeletion,
);

/**
 * @swagger
 * /api/privacy/account:
 *   delete:
 *     tags: [Privacy]
 *     summary: Permanently delete the authenticated user's account
 *     description: >
 *       Verifies the deletion token issued by POST /api/privacy/request-deletion,
 *       then hard-deletes the user and all associated records (comments, ratings,
 *       passkeys, newsletter subscription).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deletionToken]
 *             properties:
 *               deletionToken:
 *                 type: string
 *                 description: Token returned by POST /api/privacy/request-deletion
 *     responses:
 *       200:
 *         description: Account permanently deleted
 *       400:
 *         description: Missing or expired deletion token
 *       401:
 *         description: Unauthenticated
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/privacy/cancel-deletion:
 *   post:
 *     tags: [Privacy]
 *     summary: Cancel a pending account deletion request
 *     description: Clears the deletion token from the user record immediately.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Deletion request cancelled
 *       401:
 *         description: Unauthenticated
 *       500:
 *         description: Internal server error
 */
router.post("/cancel-deletion", authenticate, cancelAccountDeletion);

router.delete("/account", authenticate, confirmDeleteAccount);

export default router;
