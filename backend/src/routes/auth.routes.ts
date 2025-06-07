import { Router } from "express";
import {
  register,
  login,
  verifyEmail,
  resetPasswordRequest,
  confirmResetPassword,
} from "../controllers/auth.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication, registration, and password management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in an existing user
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     tags: [Authentication]
 *     summary: Verify user email address
 *     security:
 *       - ApiKeyAuth: []
 *     description: Verify a user's email using a verification token sent via email.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: The email address associated with the account.
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token sent to the user's email.
 *     responses:
 *       200:
 *         description: Email verified successfully.
 *       400:
 *         description: Missing email or token, or invalid verification token.
 *       500:
 *         description: Internal server error.
 */
router.get("/verify-email", verifyEmail);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request a password reset token
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Reset password token generated
 *       400:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/reset-password", resetPasswordRequest);

/**
 * @swagger
 * /api/auth/confirm-reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Confirm password reset
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, token, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or email
 *       500:
 *         description: Internal server error
 */
router.post("/confirm-reset-password", confirmResetPassword);

export default router;
