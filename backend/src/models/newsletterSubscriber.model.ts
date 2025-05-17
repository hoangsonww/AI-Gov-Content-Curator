import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     NewsletterSubscriber:
 *       type: object
 *       description: >
 *         A newsletter subscriber record.
 *         Tracks the subscriber’s email, when they subscribed, and when they were last sent a newsletter.
 *       required:
 *         - email
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *           description: MongoDB-generated unique identifier for the subscriber.
 *         email:
 *           type: string
 *           format: email
 *           description: Subscriber’s email address (unique, lowercased, trimmed).
 *         subscribedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user subscribed.
 *           default: null
 *         lastSentAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of the last newsletter sent to this subscriber, or null if never sent.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Record creation timestamp (auto-managed by Mongoose).
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           readOnly: true
 *           description: Record last update timestamp (auto-managed by Mongoose).
 */

export interface INewsletterSubscriber extends Document {
  email: string;
  subscribedAt: Date;
  lastSentAt: Date | null;
}

const NewsletterSubscriberSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    subscribedAt: {
      type: Date,
      default: () => new Date(),
    },
    /** Date of the last newsletter that *this* user received */
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model<INewsletterSubscriber>(
  "NewsletterSubscriber",
  NewsletterSubscriberSchema,
);
