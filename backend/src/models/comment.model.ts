import { Schema, model, Document, Types } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier for the comment
 *         article:
 *           type: string
 *           description: MongoDB ObjectId of the associated article
 *         user:
 *           type: string
 *           description: MongoDB ObjectId of the authoring user
 *         content:
 *           type: string
 *           description: The text content of the comment
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the comment was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the comment was last updated
 *       required:
 *         - article
 *         - user
 *         - content
 */

export interface IComment extends Document {
  article: Types.ObjectId;
  user: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    article: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export default model<IComment>("Comment", CommentSchema);
