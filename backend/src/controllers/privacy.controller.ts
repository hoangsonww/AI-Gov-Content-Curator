import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { Resend } from "resend";
import User from "../models/user.model";
import Comment from "../models/comment.model";
import Rating from "../models/rating.model";
import Passkey from "../models/passkey.model";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";

const DELETION_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const resend = new Resend(process.env.RESEND_API_KEY);
const RESEND_FROM =
  process.env.RESEND_FROM ?? "SynthoraAI <noreply@sonnguyenhoang.com>";

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

    const [comments, votes, ratings, passkeys, newsletter] = await Promise.all([
      Comment.find({ user: userId }).select("-__v").lean(),
      Comment.find({ $or: [{ upvotes: userId }, { downvotes: userId }] })
        .select("_id upvotes downvotes")
        .lean(),
      Rating.find({ userId }).select("-__v").lean(),
      Passkey.find({ userId })
        .select(
          "nickname deviceType backedUp transports aaguid lastUsedAt createdAt updatedAt",
        )
        .lean(),
      NewsletterSubscriber.findOne({ email: user.email.toLowerCase().trim() })
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
      votes: votes.map((v) => ({
        commentId: v._id,
        direction: (v.upvotes as any[]).some(
          (id: any) => id.toString() === userId.toString(),
        )
          ? "upvote"
          : "downvote",
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
 * Generates a short-lived deletion code (1 h), stores it on the user record,
 * and emails it to the registered address. The code is NOT returned in the
 * response body — the user must retrieve it from their inbox, proving email
 * control before a stolen JWT alone can complete the deletion.
 */
export const requestAccountDeletion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 8 uppercase hex chars — easy to read from email, sufficient entropy
    // given the 1 h TTL and 3/hour rate limit.
    const deletionToken = crypto.randomBytes(4).toString("hex").toUpperCase();
    const deletionTokenHash = crypto
      .createHash("sha256")
      .update(deletionToken)
      .digest("hex");
    const deletionTokenExpiry = new Date(Date.now() + DELETION_TOKEN_TTL_MS);

    // Store only the hash — plain token is emailed so a DB breach can't reuse it.
    // Use findByIdAndUpdate to avoid triggering the pre-save credential validator.
    await User.findByIdAndUpdate(userId, {
      deletionToken: deletionTokenHash,
      deletionTokenExpiry,
    });

    await resend.emails.send({
      from: RESEND_FROM,
      to: user.email,
      subject: "Confirm your SynthoraAI account deletion",
      html: `
        <p>You requested to permanently delete your SynthoraAI account.</p>
        <p>Your confirmation code is:</p>
        <h2 style="letter-spacing:0.15em;">${deletionToken}</h2>
        <p>Enter this code on the deletion confirmation page within <strong>1 hour</strong>.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    return res.json({
      message:
        "A confirmation code has been sent to your registered email address. Enter it within 1 hour to complete the deletion.",
    });
  } catch (error) {
    console.error("Error requesting account deletion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/privacy/cancel-deletion
 * Clears any pending deletion token so it doesn't linger in the DB.
 * Safe to call even if no token exists.
 */
export const cancelAccountDeletion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await User.findByIdAndUpdate(userId, {
      $unset: { deletionToken: "", deletionTokenExpiry: "" },
    });
    return res.json({ message: "Deletion request cancelled." });
  } catch (error) {
    console.error("Error cancelling account deletion:", error);
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

    const incomingHash = crypto
      .createHash("sha256")
      .update(deletionToken)
      .digest("hex");
    const storedHash = user.deletionToken ?? "";
    const tokenValid =
      storedHash.length === incomingHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(storedHash, "hex"),
        Buffer.from(incomingHash, "hex"),
      );
    if (
      !tokenValid ||
      !user.deletionTokenExpiry ||
      user.deletionTokenExpiry < new Date()
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or expired deletion token" });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Promise.all([
          Comment.deleteMany({ user: userId }).session(session),
          Comment.updateMany(
            {},
            { $pull: { upvotes: userId, downvotes: userId } },
          ).session(session),
          Rating.deleteMany({ userId }).session(session),
          Passkey.deleteMany({ userId }).session(session),
          NewsletterSubscriber.deleteOne({
            email: user.email.toLowerCase().trim(),
          }).session(session),
        ]);
        await User.findByIdAndDelete(userId).session(session);
      });
    } finally {
      await session.endSession();
    }

    return res.json({
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
