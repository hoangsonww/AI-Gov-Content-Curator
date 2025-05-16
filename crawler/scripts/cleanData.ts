#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Schema, model, Types } from "mongoose";

/* ─────────── Mongo model (same shape used elsewhere) ─────────── */
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

/* ─────────── rules ─────────── */
const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|json|xml|webmanifest|pdf|zip|gz|mp4|mpeg|mov)(\?|$)/i;

const SHARE_URL_RE =
  /(twitter\.com\/intent|x\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share|pinterest\.com\/pin\/create)/i;

const SHORT_CONTENT_LEN = 200;

/* ─────────── helpers ─────────── */
const looksBinary = (txt = ""): boolean => {
  const slice = txt.slice(0, 100);
  return /[\u0000-\u001F]/.test(slice); // non‑printable control chars
};

/* ─────────── main ─────────── */
async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Mongo connected");

  /* ---- Phase 1: bulk remove by URL pattern ---- */
  const urlDeleteRes = await Article.deleteMany({
    $or: [
      { url: { $regex: STATIC_EXT_RE } },
      { url: { $regex: SHARE_URL_RE } },
    ],
  });
  console.log(`Phase 1  removed by URL  : ${urlDeleteRes.deletedCount}`);

  /* ---- Phase 2: stream & inspect remainder ---- */
  const idsToZap: Types.ObjectId[] = [];
  const cursor = Article.find({}, { _id: 1, title: 1, content: 1 })
    .lean()
    .cursor();

  for await (const doc of cursor) {
    const title = (doc as any).title?.trim() ?? "";
    const content = (doc as any).content ?? "";

    if (
      (content.length < SHORT_CONTENT_LEN && !title) ||
      looksBinary(content)
    ) {
      idsToZap.push((doc as any)._id);
    }
  }

  const phase2Res = idsToZap.length
    ? await Article.deleteMany({ _id: { $in: idsToZap } })
    : { deletedCount: 0 };

  console.log(`Phase 2  removed by content/title: ${phase2Res.deletedCount}`);
  console.log("Cleanup complete ✅");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
