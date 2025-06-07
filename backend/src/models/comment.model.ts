import { Schema, model, Document, Types } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         _id:        { type: string }
 *         article:    { type: string, description: "Article ObjectId" }
 *         user:       { type: string, description: "Authoring User ObjectId" }
 *         content:    { type: string }
 *         upvotes:
 *           type: array
 *           items: { type: string }
 *         downvotes:
 *           type: array
 *           items: { type: string }
 *         score:
 *           type: integer
 *           description: "upvotes.length − downvotes.length (virtual)"
 *         createdAt:  { type: string, format: date‑time }
 *         updatedAt:  { type: string, format: date‑time }
 *       required: [article, user, content]
 */

export interface IComment extends Document {
  article: Types.ObjectId;
  user: Types.ObjectId;
  content: string;
  upvotes: Types.Array<Types.ObjectId>;
  downvotes: Types.Array<Types.ObjectId>;
  createdAt: Date;
  updatedAt: Date;
  score?: number; // virtual
}

const CommentSchema = new Schema<IComment>(
  {
    article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
    upvotes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/* computed score */
CommentSchema.virtual("score").get(function (this: IComment) {
  return (this.upvotes?.length || 0) - (this.downvotes?.length || 0);
});

export default model<IComment>("Comment", CommentSchema);
