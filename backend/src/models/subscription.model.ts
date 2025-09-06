import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Subscription:
 *       type: object
 *       description: >
 *         A user's subscription preferences for receiving real-time notifications
 *         when new articles matching their criteria are ingested.
 *       required:
 *         - userId
 *         - mode
 *       properties:
 *         _id:
 *           type: string
 *           readOnly: true
 *           description: MongoDB-generated unique identifier for the subscription.
 *         userId:
 *           type: string
 *           description: Reference to the user who owns this subscription.
 *         topics:
 *           type: array
 *           items:
 *             type: string
 *           description: List of topics the user wants to subscribe to.
 *           default: []
 *         keywords:
 *           type: array
 *           items:
 *             type: string
 *           description: List of keywords the user wants to be notified about.
 *           default: []
 *         sources:
 *           type: array
 *           items:
 *             type: string
 *           description: List of sources the user wants to subscribe to.
 *           default: []
 *         mode:
 *           type: string
 *           enum: ['realtime', 'daily']
 *           description: Notification delivery mode - realtime alerts or daily digest.
 *           default: 'realtime'
 *         emailEnabled:
 *           type: boolean
 *           description: Whether email notifications are enabled.
 *           default: true
 *         pushEnabled:
 *           type: boolean
 *           description: Whether web push notifications are enabled.
 *           default: false
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

export interface ISubscription extends Document {
  userId: string;
  topics: string[];
  keywords: string[];
  sources: string[];
  mode: 'realtime' | 'daily';
  emailEnabled: boolean;
  pushEnabled: boolean;
}

const SubscriptionSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    topics: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
    sources: {
      type: [String],
      default: [],
    },
    mode: {
      type: String,
      enum: ['realtime', 'daily'],
      default: 'realtime',
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    pushEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Index for efficient queries
SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ mode: 1 });
SubscriptionSchema.index({ topics: 1 });
SubscriptionSchema.index({ sources: 1 });

export default mongoose.model<ISubscription>("Subscription", SubscriptionSchema);