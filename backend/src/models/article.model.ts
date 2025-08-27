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
  // Clustering fields
  clusterId?: any; // ObjectId
  normalizedTitle?: string;
  normalizedLead?: string;
  signatures?: {
    minhash?: string;
    tfidf?: string;
  };
  entities?: {
    persons: string[];
    orgs: string[];
    places: string[];
    topics: string[];
  };
}

const articleSchema = new Schema<IArticle>({
  url: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  topics: { type: [String], default: [] },
  source: { type: String, required: true },
  fetchedAt: { type: Date, default: Date.now },
  // Clustering fields
  clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster' },
  normalizedTitle: { type: String },
  normalizedLead: { type: String },
  signatures: {
    minhash: { type: String },
    tfidf: { type: String }
  },
  entities: {
    persons: { type: [String], default: [] },
    orgs: { type: [String], default: [] },
    places: { type: [String], default: [] },
    topics: { type: [String], default: [] }
  }
});

// Create indexes for clustering performance
articleSchema.index({ clusterId: 1 });
articleSchema.index({ 'signatures.minhash': 1 });
articleSchema.index({ createdAt: -1 });
articleSchema.index({ url: 1 }, { unique: true });

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
