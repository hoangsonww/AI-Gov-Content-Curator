import { Request, Response } from "express";
import crypto from "crypto";
import User from "../models/user.model";
import Passkey from "../models/passkey.model";
import WebAuthnChallenge from "../models/webauthn-challenge.model";
import {
  RP_ID,
  RP_NAME,
  RP_ORIGINS,
  CHALLENGE_TTL_MS,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "../services/webauthn.service";
import { signJwt } from "../services/auth-token.service";

// Auth middleware decorates req via `(req as any).user = { id, email }`.
const getAuth = (req: Request): { id: string; email: string } | undefined =>
  (req as any).user;

const expiresAt = () => new Date(Date.now() + CHALLENGE_TTL_MS);

/**
 * Begin passkey registration for a logged-in user.
 *
 * @param req Authenticated request
 * @param res Response with PublicKeyCredentialCreationOptionsJSON
 */
export const beginRegistration = async (req: Request, res: Response) => {
  try {
    const userId = getAuth(req)?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await Passkey.find({ userId: user._id });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(String(user._id)),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({
        id: p.credentialId,
        transports: p.transports,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      type: "registration",
      userId: user._id,
      expiresAt: expiresAt(),
    });

    return res.json(options);
  } catch (error) {
    console.error("Error in passkey registration begin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Verify and persist a passkey registration response.
 */
export const verifyRegistration = async (req: Request, res: Response) => {
  try {
    const userId = getAuth(req)?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const { response, nickname } = req.body || {};
    if (!response) return res.status(400).json({ error: "Missing response" });

    const expectedChallenge = response.response?.clientDataJSON
      ? JSON.parse(
          Buffer.from(response.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        ).challenge
      : null;

    if (!expectedChallenge)
      return res.status(400).json({ error: "Missing challenge in response" });

    const challengeRow = await WebAuthnChallenge.findOne({
      challenge: expectedChallenge,
      type: "registration",
      userId,
    });
    if (!challengeRow)
      return res.status(400).json({ error: "Challenge not found" });
    if (challengeRow.expiresAt.getTime() < Date.now()) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Challenge expired" });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: RP_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Verification failed" });
    }

    const info: any = verification.registrationInfo;
    // SimpleWebAuthn returns either a flat shape (older) or a nested
    // `credential` object (v11+). Normalize.
    const cred = info.credential || info;
    const credentialID: string | Uint8Array = cred.id ?? info.credentialID;
    const credentialPublicKey: Uint8Array =
      cred.publicKey ?? info.credentialPublicKey;
    const counter: number = cred.counter ?? info.counter ?? 0;
    const credentialDeviceType: "singleDevice" | "multiDevice" =
      info.credentialDeviceType || "singleDevice";
    const credentialBackedUp: boolean = !!info.credentialBackedUp;
    const aaguid: string | undefined = info.aaguid;

    const credentialIdString =
      typeof credentialID === "string"
        ? credentialID
        : Buffer.from(credentialID).toString("base64url");

    const user = await User.findById(userId);
    if (!user) {
      await challengeRow.deleteOne();
      return res.status(404).json({ error: "User not found" });
    }

    const passkey = await Passkey.create({
      userId: user._id,
      credentialId: credentialIdString,
      publicKey: Buffer.from(credentialPublicKey),
      counter,
      transports: response.response?.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      nickname: (nickname && String(nickname).trim()) || "Passkey",
      aaguid,
    });

    user.hasPasskeys = true;
    await user.save();
    await challengeRow.deleteOne();

    return res.status(201).json({
      id: passkey._id,
      nickname: passkey.nickname,
      createdAt: passkey.createdAt,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
    });
  } catch (error) {
    console.error("Error in passkey registration verify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Begin passkey authentication. Discoverable / usernameless.
 */
export const beginAuthentication = async (req: Request, res: Response) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: [],
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      type: "authentication",
      expiresAt: expiresAt(),
    });

    return res.json(options);
  } catch (error) {
    console.error("Error in passkey authentication begin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Verify a passkey authentication response and issue a JWT.
 */
export const verifyAuthentication = async (req: Request, res: Response) => {
  try {
    const { response } = req.body || {};
    if (!response) return res.status(400).json({ error: "Missing response" });

    const expectedChallenge = response.response?.clientDataJSON
      ? JSON.parse(
          Buffer.from(response.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        ).challenge
      : null;
    if (!expectedChallenge)
      return res.status(400).json({ error: "Missing challenge in response" });

    const challengeRow = await WebAuthnChallenge.findOne({
      challenge: expectedChallenge,
      type: "authentication",
    });
    if (!challengeRow)
      return res.status(400).json({ error: "Challenge not found" });
    if (challengeRow.expiresAt.getTime() < Date.now()) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Challenge expired" });
    }

    const credentialId: string = response.id;
    if (!credentialId)
      return res.status(400).json({ error: "Missing credential id" });

    const passkey = await Passkey.findOne({ credentialId });
    if (!passkey) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Unknown credential" });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: RP_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as any,
      },
    });

    if (!verification.verified) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Verification failed" });
    }

    const newCounter = verification.authenticationInfo?.newCounter ?? 0;
    passkey.counter = newCounter;
    passkey.lastUsedAt = new Date();
    await passkey.save();
    await challengeRow.deleteOne();

    const user = await User.findById(passkey.userId);
    if (!user) return res.status(400).json({ error: "Owning user not found" });

    const token = signJwt(user);
    res.setHeader("Authorization", token);

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Error in passkey authentication verify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Begin passkey-only signup. Does NOT create the user yet — the User row
 * is materialized on /signup/verify after the WebAuthn ceremony succeeds.
 * Email + name are pinned to the challenge row so an abandoned ceremony
 * leaves no orphan account.
 */
export const beginSignup = async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    // Use a stable random userHandle so abandoned ceremonies don't leak email
    // bytes into the authenticator's resident credential metadata.
    const userHandle = crypto.randomBytes(32);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userHandle,
      userName: email,
      userDisplayName: name || email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await WebAuthnChallenge.create({
      challenge: options.challenge,
      type: "registration",
      // No userId — user does not exist yet. email is the link.
      email,
      expiresAt: expiresAt(),
    });

    return res.json(options);
  } catch (error) {
    console.error("Error in passkey signup begin:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Verify passkey-only signup, materialize the user, attach the credential,
 * issue JWT.
 */
export const verifySignup = async (req: Request, res: Response) => {
  try {
    const { email, response, nickname, name } = req.body || {};
    if (!email || !response)
      return res.status(400).json({ error: "Missing email or response" });

    const expectedChallenge = response.response?.clientDataJSON
      ? JSON.parse(
          Buffer.from(response.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        ).challenge
      : null;
    if (!expectedChallenge)
      return res.status(400).json({ error: "Missing challenge in response" });

    // Find the pending signup challenge by challenge + email — no user exists yet.
    const challengeRow = await WebAuthnChallenge.findOne({
      challenge: expectedChallenge,
      type: "registration",
      email,
    });
    if (!challengeRow)
      return res.status(400).json({ error: "Challenge not found" });
    if (challengeRow.expiresAt.getTime() < Date.now()) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Challenge expired" });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: RP_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Verification failed" });
    }

    const info: any = verification.registrationInfo;
    const cred = info.credential || info;
    const credentialID: string | Uint8Array = cred.id ?? info.credentialID;
    const credentialPublicKey: Uint8Array =
      cred.publicKey ?? info.credentialPublicKey;
    const counter: number = cred.counter ?? info.counter ?? 0;
    const credentialDeviceType: "singleDevice" | "multiDevice" =
      info.credentialDeviceType || "singleDevice";
    const credentialBackedUp: boolean = !!info.credentialBackedUp;
    const aaguid: string | undefined = info.aaguid;

    const credentialIdString =
      typeof credentialID === "string"
        ? credentialID
        : Buffer.from(credentialID).toString("base64url");

    // Re-check for race: another caller may have created this email between
    // /signup/begin and /signup/verify. If so, refuse rather than overwrite.
    const collision = await User.findOne({ email });
    if (collision) {
      await challengeRow.deleteOne();
      return res.status(400).json({ error: "Email already registered" });
    }

    const verificationToken = crypto.randomBytes(20).toString("hex");
    const user = new User({
      email,
      name,
      isVerified: false,
      verificationToken,
      hasPasskeys: true,
      favorites: [],
    });
    await user.save();

    try {
      await Passkey.create({
        userId: user._id,
        credentialId: credentialIdString,
        publicKey: Buffer.from(credentialPublicKey),
        counter,
        transports: response.response?.transports || [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        nickname: (nickname && String(nickname).trim()) || "Passkey",
        aaguid,
      });
    } catch (e) {
      // If passkey persistence fails (e.g. duplicate credentialId), unwind
      // the user we just created so we don't leave an orphan.
      await user.deleteOne();
      await challengeRow.deleteOne();
      throw e;
    }

    await challengeRow.deleteOne();

    const token = signJwt(user);
    res.setHeader("Authorization", token);

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Error in passkey signup verify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * List the caller's passkeys.
 */
export const listPasskeys = async (req: Request, res: Response) => {
  try {
    const userId = getAuth(req)?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const passkeys = await Passkey.find({ userId }).sort({ createdAt: -1 });
    return res.json(
      passkeys.map((p) => ({
        id: p._id,
        nickname: p.nickname,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
        deviceType: p.deviceType,
        backedUp: p.backedUp,
      })),
    );
  } catch (error) {
    console.error("Error listing passkeys:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Rename a passkey.
 */
export const renamePasskey = async (req: Request, res: Response) => {
  try {
    const userId = getAuth(req)?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const { id } = req.params;
    const { nickname } = req.body || {};
    if (!nickname || !String(nickname).trim())
      return res.status(400).json({ error: "Nickname is required" });

    const passkey = await Passkey.findOne({ _id: id, userId });
    if (!passkey) return res.status(404).json({ error: "Passkey not found" });

    passkey.nickname = String(nickname).trim().slice(0, 64);
    await passkey.save();

    return res.json({ id: passkey._id, nickname: passkey.nickname });
  } catch (error) {
    console.error("Error renaming passkey:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete a passkey. Refuses if it would orphan the account
 * (no password, last passkey).
 */
export const deletePasskey = async (req: Request, res: Response) => {
  try {
    const userId = getAuth(req)?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const { id } = req.params;

    const passkey = await Passkey.findOne({ _id: id, userId });
    if (!passkey) return res.status(404).json({ error: "Passkey not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const remaining = await Passkey.countDocuments({ userId });
    if (remaining <= 1 && !user.password) {
      return res.status(400).json({
        error:
          "Cannot delete your last passkey while no password is set. Set a password first via the reset flow, then delete.",
      });
    }

    await passkey.deleteOne();
    if (remaining <= 1) {
      user.hasPasskeys = false;
      await user.save();
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting passkey:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
