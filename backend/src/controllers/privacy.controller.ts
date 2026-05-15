import { Request, Response } from "express";
import crypto from "crypto";
import User from "../models/user.model";
import Comment from "../models/comment.model";
import Rating from "../models/rating.model";
import Passkey from "../models/passkey.model";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";

const DELETION_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/privacy/export
 * Returns a JSON attachment containing all data held for the authenticated user.
 * Omits password hash, internal tokens, and raw passkey public keys.
 */
export const exportUserData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const [comments, ratings, passkeys, newsletter] = await Promise.all([
      Comment.find({ user: userId }).select("-__v").lean(),
      Rating.find({ userId }).select("-__v").lean(),
      Passkey.find({ userId })
        .select(
          "nickname deviceType backedUp transports aaguid lastUsedAt createdAt updatedAt",
        )
        .lean(),
      NewsletterSubscriber.findOne({ email: user.email })
        .select("subscribedAt lastSentAt")
        .lean(),
    ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user._id,
        email: user.email,
        name: user.name ?? null,
        isVerified: user.isVerified,
        hasPasskeys: user.hasPasskeys ?? false,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt,
      },
      favorites: user.favorites,
      comments: comments.map((c) => ({
        id: c._id,
        articleId: c.article,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      ratings: ratings.map((r) => ({
        id: r._id,
        articleId: r.articleId,
        value: r.value,
        ratingType: r.ratingType,
        comment: r.comment ?? null,
        createdAt: r.createdAt,
      })),
      passkeys: passkeys.map((p) => ({
        nickname: p.nickname,
        deviceType: p.deviceType,
        backedUp: p.backedUp,
        transports: p.transports ?? [],
        aaguid: p.aaguid ?? null,
        lastUsedAt: p.lastUsedAt ?? null,
        createdAt: p.createdAt,
      })),
      newsletterSubscription: newsletter
        ? {
            subscribedAt: newsletter.subscribedAt,
            lastSentAt: newsletter.lastSentAt ?? null,
          }
        : null,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="synthoraai-export-${userId}.json"`,
    );
    return res.json(exportPayload);
  } catch (error) {
    console.error("Error exporting user data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/privacy/request-deletion
 * Generates a short-lived deletion token (1 h) and stores it on the user record.
 * Returns the token to the caller — the frontend holds it in memory and passes
 * it to DELETE /api/privacy/account to complete the flow.
 */
export const requestAccountDeletion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const deletionToken = crypto.randomBytes(32).toString("hex");
    const deletionTokenExpiry = new Date(Date.now() + DELETION_TOKEN_TTL_MS);

    // Use findByIdAndUpdate to avoid triggering the pre-save credential validator.
    await User.findByIdAndUpdate(userId, { deletionToken, deletionTokenExpiry });

    return res.json({
      message:
        "Deletion token issued. Confirm within 1 hour to permanently delete your account.",
      deletionToken,
      expiresAt: deletionTokenExpiry.toISOString(),
    });
  } catch (error) {
    console.error("Error requesting account deletion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/privacy/account
 * Verifies the deletion token then hard-deletes the user and all linked records:
 * comments, ratings, passkeys, newsletter subscription.
 * Body: { deletionToken: string }
 */
export const confirmDeleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { deletionToken } = req.body;

    if (!deletionToken) {
      return res.status(400).json({ error: "deletionToken is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (
      user.deletionToken !== deletionToken ||
      !user.deletionTokenExpiry ||
      user.deletionTokenExpiry < new Date()
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or expired deletion token" });
    }

    await Promise.all([
      Comment.deleteMany({ user: userId }),
      Rating.deleteMany({ userId }),
      Passkey.deleteMany({ userId }),
      NewsletterSubscriber.deleteOne({ email: user.email }),
    ]);

    await User.findByIdAndDelete(userId);

    return res.json({
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
