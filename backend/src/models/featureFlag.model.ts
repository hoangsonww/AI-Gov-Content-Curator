import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     FeatureFlag:
 *       type: object
 *       required:
 *         - key
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         key:
 *           type: string
 *           description: Unique, lowercase, kebab/snake-case flag identifier
 *           example: ai-bias-analysis
 *         description:
 *           type: string
 *           description: Human-readable explanation of what this flag gates
 *         enabled:
 *           type: boolean
 *           description: Master switch. false disables the flag for everyone — this is the kill switch.
 *           default: true
 *         rolloutPercentage:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Percentage of identities deterministically bucketed into the rollout
 *           default: 100
 *         audience:
 *           type: object
 *           properties:
 *             internalUsers:
 *               type: boolean
 *               description: If true, internal users bypass the percentage rollout
 *               default: false
 *             premiumOnly:
 *               type: boolean
 *               description: If true, only premium users are eligible, regardless of rollout percentage
 *               default: false
 *         overrides:
 *           type: object
 *           properties:
 *             allow:
 *               type: array
 *               items:
 *                 type: string
 *               description: User ids/emails explicitly forced on
 *             deny:
 *               type: array
 *               items:
 *                 type: string
 *               description: User ids/emails explicitly forced off (wins over allow)
 *         createdBy:
 *           type: string
 *           description: Admin email that created this flag
 *         updatedBy:
 *           type: string
 *           description: Admin email that last updated this flag
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export interface IFeatureFlag extends Document {
  key: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  audience: {
    internalUsers: boolean;
    premiumOnly: boolean;
  };
  overrides: {
    allow: string[];
    deny: string[];
  };
  createdBy?: string;
  updatedBy?: string;
}

const FeatureFlagSchema: Schema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_-]+$/,
    },
    description: { type: String },
    enabled: { type: Boolean, default: true },
    rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 },
    audience: {
      internalUsers: { type: Boolean, default: false },
      premiumOnly: { type: Boolean, default: false },
    },
    overrides: {
      allow: [{ type: String }],
      deny: [{ type: String }],
    },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);
