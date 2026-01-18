import mongoose, { Schema, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     FilterPreset:
 *       type: object
 *       required:
 *         - userId
 *         - name
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         userId:
 *           type: string
 *           description: ID of the user who owns this preset
 *         name:
 *           type: string
 *           description: User-defined name for the preset
 *         filters:
 *           type: object
 *           description: Filter criteria to be applied
 *           properties:
 *             source:
 *               type: string
 *               description: Filter by article source
 *             topic:
 *               type: string
 *               description: Filter by topic (comma-separated)
 *             dateRange:
 *               type: object
 *               properties:
 *                 from:
 *                   type: string
 *                   format: date-time
 *                 to:
 *                   type: string
 *                   format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the preset was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the preset was last updated
 */

export interface IFilterPreset extends Document {
  userId: string;
  name: string;
  filters: {
    source?: string;
    topic?: string;
    dateRange?: {
      from?: Date;
      to?: Date;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const FilterPresetSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    filters: {
      source: { type: String },
      topic: { type: String },
      dateRange: {
        from: { type: Date },
        to: { type: Date },
      },
    },
  },
  { timestamps: true },
);

// Ensure a user cannot have duplicate preset names
FilterPresetSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model<IFilterPreset>(
  "FilterPreset",
  FilterPresetSchema,
);
