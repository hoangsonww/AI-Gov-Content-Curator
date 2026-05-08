import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  beginRegistration,
  verifyRegistration,
  beginAuthentication,
  verifyAuthentication,
  beginSignup,
  verifySignup,
  listPasskeys,
  renamePasskey,
  deletePasskey,
} from "../controllers/passkey.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Passkeys
 *     description: WebAuthn / FIDO2 passkey registration and authentication
 */

/**
 * @swagger
 * /api/auth/passkey/register/begin:
 *   post:
 *     tags: [Passkeys]
 *     summary: Begin passkey registration for the authenticated user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: PublicKeyCredentialCreationOptionsJSON
 *       401:
 *         description: Unauthenticated
 */
router.post("/register/begin", authenticate, beginRegistration);

/**
 * @swagger
 * /api/auth/passkey/register/verify:
 *   post:
 *     tags: [Passkeys]
 *     summary: Verify a passkey registration response and persist the credential
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       201:
 *         description: Passkey registered
 *       400:
 *         description: Verification failed
 */
router.post("/register/verify", authenticate, verifyRegistration);

/**
 * @swagger
 * /api/auth/passkey/authenticate/begin:
 *   post:
 *     tags: [Passkeys]
 *     summary: Begin discoverable passkey authentication (usernameless)
 *     responses:
 *       200:
 *         description: PublicKeyCredentialRequestOptionsJSON
 */
router.post("/authenticate/begin", beginAuthentication);

/**
 * @swagger
 * /api/auth/passkey/authenticate/verify:
 *   post:
 *     tags: [Passkeys]
 *     summary: Verify a passkey authentication response and issue a JWT
 *     responses:
 *       200:
 *         description: User and JWT
 *       400:
 *         description: Verification failed
 */
router.post("/authenticate/verify", verifyAuthentication);

/**
 * @swagger
 * /api/auth/passkey/signup/begin:
 *   post:
 *     tags: [Passkeys]
 *     summary: Begin passkey-only signup (creates a user without a password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: PublicKeyCredentialCreationOptionsJSON
 *       400:
 *         description: User already exists or invalid input
 */
router.post("/signup/begin", beginSignup);

/**
 * @swagger
 * /api/auth/passkey/signup/verify:
 *   post:
 *     tags: [Passkeys]
 *     summary: Verify passkey signup, attach credential, return JWT
 *     responses:
 *       201:
 *         description: User and JWT
 *       400:
 *         description: Verification failed
 */
router.post("/signup/verify", verifySignup);

/**
 * @swagger
 * /api/auth/passkey:
 *   get:
 *     tags: [Passkeys]
 *     summary: List the caller's passkeys
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Array of passkeys
 *       401:
 *         description: Unauthenticated
 */
router.get("/", authenticate, listPasskeys);

/**
 * @swagger
 * /api/auth/passkey/{id}:
 *   patch:
 *     tags: [Passkeys]
 *     summary: Rename a passkey
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nickname]
 *             properties:
 *               nickname: { type: string }
 *     responses:
 *       200:
 *         description: Updated passkey
 *       404:
 *         description: Not found
 */
router.patch("/:id", authenticate, renamePasskey);

/**
 * @swagger
 * /api/auth/passkey/{id}:
 *   delete:
 *     tags: [Passkeys]
 *     summary: Delete a passkey
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Cannot delete last passkey when no password is set
 *       404:
 *         description: Not found
 */
router.delete("/:id", authenticate, deletePasskey);

export default router;
