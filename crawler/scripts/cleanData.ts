#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose, { Schema, Types } from "mongoose";

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
// Avoid OverwriteModelError by reusing existing model if already defined
const Article =
  mongoose.models.Article || mongoose.model("Article", ArticleSchema);

/* ─────────── ENV ─────────── */
const { MONGODB_URI = "" } = process.env;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is required");
}

/* ─────────── Heuristic patterns ─────────── */

/** 1) Non-article URLs (assets, share intents) */
const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|json|xml|webmanifest|pdf|zip|gz|mp4|mpeg|mov)(\?|$)/i;
const SHARE_URL_RE =
  /(twitter\.com\/intent|x\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share|pinterest\.com\/pin\/create)/i;

/** 2) Pages that are clearly errors or placeholders */
const ERROR_TITLE_RE =
  /\b(page\s+(?:not\s+found|unavailable)|404\s+error|error\s+404|oops!|access\s+denied|forbidden|blocked)\b/i;
const ERROR_CONTENT_RE =
  /(STATUS CODE:\s*404|does not exist|currently unavailable|404\s*error|page not found|access denied|forbidden|internal server error|http 403|http 404|http 500)/i;

/** 3) Boilerplate apology / inability text */
const BOILERPLATE_RE =
  /\b(I am sorry|unable to (?:access|summarize|process|retrieve))\b/i;

/** 4) Too-short content threshold */
const SHORT_CONTENT_LEN = 200;

/** 5) Detect binary/control characters in the first 100 chars */
function looksBinary(txt = ""): boolean {
  return /[\u0000-\u001F]/.test(txt.slice(0, 100));
}

/**
 * Connects to Mongo, deletes unmeaningful articles by a series of heuristics,
 * then normalizes odd titles, then disconnects. Logs each phase’s result.
 */
export async function cleanupArticles(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB connected");

  // Phase 1 — Remove by URL pattern
  const { deletedCount: urlDeleted } = await Article.deleteMany({
    $or: [
      { url: { $regex: STATIC_EXT_RE } },
      { url: { $regex: SHARE_URL_RE } },
    ],
  });
  console.log(`Phase 1 — removed by URL patterns: ${urlDeleted}`);

  // Phase 2 — Stream remaining docs and apply content/title heuristics
  const toDelete: Types.ObjectId[] = [];
  const cursor = Article.find({}, { _id: 1, title: 1, content: 1, summary: 1 })
    .lean()
    .cursor();

  for await (const doc of cursor) {
    const title = ((doc as any).title || "").trim();
    const content = ((doc as any).content || "").trim();
    const summary = ((doc as any).summary || "").trim();

    // New: Remove any articles containing embedded iframes or similar tags
    const hasIframe = /<iframe\b[^>]*>/i.test(content);
    if (hasIframe) {
      toDelete.push((doc as any)._id);
      continue;
    }

    // Heuristic flags
    const isUntitled = title.toLowerCase() === "untitled";
    const tooShort = !title && content.length < SHORT_CONTENT_LEN;
    const isBinary = looksBinary(content);
    const isErrorish =
      ERROR_TITLE_RE.test(title) || ERROR_CONTENT_RE.test(content);
    const isBoiler =
      BOILERPLATE_RE.test(content) || BOILERPLATE_RE.test(summary);

    if (isUntitled || tooShort || isBinary || isErrorish || isBoiler) {
      toDelete.push((doc as any)._1);
    }
  }

  const { deletedCount: heurDeleted } = toDelete.length
    ? await Article.deleteMany({ _id: { $in: toDelete } })
    : { deletedCount: 0 };

  console.log(
    `Phase 2 — removed by content/title heuristics & embeds: ${heurDeleted}`,
  );

  // Phase 3 — Normalize odd titles (leading punctuation/whitespace, etc.)
  const ODD_TITLE_RE = /^[^A-Za-z0-9]+/;
  const bulkOps: any[] = [];
  const cursor2 = Article.find(
    { title: { $regex: ODD_TITLE_RE } },
    { _id: 1, title: 1 },
  )
    .lean()
    .cursor();

  for await (const doc of cursor2) {
    const rawTitle = (doc as any).title || "";
    const cleaned = rawTitle.replace(ODD_TITLE_RE, "").trim();
    if (cleaned && cleaned !== rawTitle) {
      bulkOps.push({
        updateOne: {
          filter: { _id: (doc as any)._id },
          update: { $set: { title: cleaned } },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    const bulkResult = await Article.bulkWrite(bulkOps);
    console.log(
      `Phase 3 — normalized titles on ${bulkResult.modifiedCount} articles`,
    );
  } else {
    console.log("Phase 3 — no odd titles found to normalize");
  }

  console.log("🧹 Cleanup complete");
  await mongoose.disconnect();
  console.log("✅ MongoDB disconnected");
}

/**
 * If invoked directly (`ts-node cleanup-articles.ts`), run immediately.
 */
if (require.main === module) {
  cleanupArticles().catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
}
