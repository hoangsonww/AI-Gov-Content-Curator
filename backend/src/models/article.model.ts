import { Schema, model, Document } from "mongoose";

export interface IArticle extends Document {
  url: string;
  title: string;
  content: string;
  summary: string;
  source: string;
  fetchedAt: Date;
}

const articleSchema = new Schema<IArticle>({
  url: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  summary: { type: String },
  content: { type: String, required: true },
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
      summary: ret.summary,
      content: ret.content,
      source: ret.source,
      fetchedAt: ret.fetchedAt,
    };
  },
});

export default model<IArticle>("Article", articleSchema);
