"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var articleSchema = new mongoose_1.Schema({
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
var Article = (0, mongoose_1.model)("Article", articleSchema);
exports.default = Article;
