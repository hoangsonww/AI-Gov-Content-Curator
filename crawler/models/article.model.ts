import { Schema, model, Document } from "mongoose";

export interface IArticle extends Document {
  url: string;
  title: string;
  content: string;
  summary: string;
  /** Summary in the original language of the article */
  summaryOriginal: string;
  /** Summary translated to English */
  summaryTranslated: string;
  /** ISO 639-3 language code of the original article (e.g., 'eng', 'spa', 'fra') */
  language: string;
  /** Human-readable language name (e.g., 'English', 'Spanish', 'French') */
  languageName: string;
  topics: string[];
  source: string;
  fetchedAt: Date;
}

const articleSchema = new Schema<IArticle>({
  url: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String },
  summaryOriginal: { type: String },
  summaryTranslated: { type: String },
  language: { type: String, default: "eng" },
  languageName: { type: String, default: "English" },
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
      summaryOriginal: ret.summaryOriginal,
      summaryTranslated: ret.summaryTranslated,
      language: ret.language,
      languageName: ret.languageName,
      topics: ret.topics,
      source: ret.source,
      fetchedAt: ret.fetchedAt,
    };
  },
});

const Article = model<IArticle>("Article", articleSchema);
export default Article;
