#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose, { Schema, model, Types } from "mongoose";

/* ─────────── Mongo model (minimal shape) ─────────── */
const ArticleSchema = new Schema({
  url: String,
  title: String,
  content: String,
  summary: String,
  topics: [String],
  source: String,
  fetchedAt: Date,
});
const Article = model("Article", ArticleSchema);

/* ─────────── ENV ─────────── */
const { MONGODB_URI = "" } = process.env;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

/* ─────────── heuristics ─────────── */

/* 1. obvious non‑article URLs */
const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|json|xml|webmanifest|pdf|zip|gz|mp4|mpeg|mov)(\?|$)/i;

const SHARE_URL_RE =
  /(twitter\.com\/intent|x\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share|pinterest\.com\/pin\/create)/i;

/* 2. error / placeholder signals */
const ERROR_TITLE_RE =
  /\b(page\s+(?:not\s+found|unavailable)|404\s+error|error\s+404|oops!|access\s+denied|forbidden|request\s+blocked)\b/i;

const ERROR_CONTENT_RE =
  /(STATUS CODE:\s*404|does not exist|currently unavailable|404\s*error|page not found|access denied|forbidden|contact your administrator|internal server error|http 403|http 404|http 500)/i;

/* 3. short junk */
const SHORT_CONTENT_LEN = 200;

/* 4. binary / control chars */
const looksBinary = (txt = "") => /[\u0000-\u001F]/.test(txt.slice(0, 100));

/* ─────────── main ─────────── */
async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Mongo connected");

  /* ---- Phase 1 — URL level prune ---- */
  const urlDel = await Article.deleteMany({
    $or: [
      { url: { $regex: STATIC_EXT_RE } },
      { url: { $regex: SHARE_URL_RE } },
    ],
  });
  console.log(`Phase 1 — removed by URL: ${urlDel.deletedCount}`);

  /* ---- Phase 2 — stream & heuristic checks ---- */
  const ids: Types.ObjectId[] = [];
  const cur = Article.find({}, { _id: 1, title: 1, content: 1 })
    .lean()
    .cursor();

  for await (const doc of cur) {
    const title = (doc as any).title?.trim() ?? "";
    const content = (doc as any).content ?? "";

    const tooShort = !title && content.length < SHORT_CONTENT_LEN;
    const errorish =
      ERROR_TITLE_RE.test(title) || ERROR_CONTENT_RE.test(content);
    const binary = looksBinary(content);

    if (tooShort || errorish || binary) ids.push((doc as any)._id);
  }

  const phase2 = ids.length
    ? await Article.deleteMany({ _id: { $in: ids } })
    : { deletedCount: 0 };

  console.log(`Phase 2 — removed by heuristics: ${phase2.deletedCount}`);
  console.log("Cleanup complete ✅");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
