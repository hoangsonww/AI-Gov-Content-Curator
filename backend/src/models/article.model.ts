import { Schema, model, Document } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Article:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Unique identifier of the article.
 *         url:
 *           type: string
 *           description: The original URL from which the article was fetched.
 *         title:
 *           type: string
 *           description: The title of the article.
 *         content:
 *           type: string
 *           description: The full content of the article.
 *         summary:
 *           type: string
 *           description: A short summary of the article content.
 *         topics:
 *           type: array
 *           items:
 *             type: string
 *         source:
 *           type: string
 *           description: The source or publisher of the article.
 *         fetchedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the article was fetched.
 *     FavoriteResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Status message of the request.
 *         favorites:
 *           type: array
 *           items:
 *             type: string
 *           description: List of favorite article IDs.
 */

export interface IArticle extends Document {
  url: string;
  title: string;
  content: string;
  summary: string;
  topics: string[];
  source: string;
  fetchedAt: Date;
}

const articleSchema = new Schema<IArticle>({
  url: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  topics: { type: [String], default: [] },
  source: { type: String, required: true },
  fetchedAt: { type: Date, default: Date.now },
});

// Set a custom toJSON transform to enforce key ordering
articleSchema.set("toJSON", {
  transform: function (doc, ret) {
    return {
      _id: ret._id,
      url: ret.url,
      title: ret.title,
      content: ret.content,
      summary: ret.summary,
      topics: ret.topics,
      source: ret.source,
      fetchedAt: ret.fetchedAt,
    };
  },
});

const Article = model<IArticle>("Article", articleSchema);
export default Article;
