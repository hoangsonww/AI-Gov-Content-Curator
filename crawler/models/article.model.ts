import { Schema, model, Document } from "mongoose";

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
