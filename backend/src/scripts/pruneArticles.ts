#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Article from "../models/article.model";

const { MONGODB_URI = "" } = process.env;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

interface PruneStats {
  totalArticles: number;
  articlesRemoved: number;
  duplicatesRemoved: number;
  oldArticlesRemoved: number;
  lowQualityRemoved: number;
  orphanedRemoved: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_CONTENT_LENGTH = 300;
const MIN_TITLE_LENGTH = 10;

async function pruneArticles(dryRun: boolean = false): Promise<PruneStats> {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const stats: PruneStats = {
    totalArticles: 0,
    articlesRemoved: 0,
    duplicatesRemoved: 0,
    oldArticlesRemoved: 0,
    lowQualityRemoved: 0,
    orphanedRemoved: 0,
  };

  stats.totalArticles = await Article.countDocuments();
  console.log(
    `Starting pruning process. Total articles: ${stats.totalArticles}`,
  );

  const cutoffDate90 = new Date(Date.now() - NINETY_DAYS_MS);
  const cutoffDate30 = new Date(Date.now() - THIRTY_DAYS_MS);

  console.log("Phase 1: Removing duplicate articles (same URL)...");
  const duplicateResults = await Article.aggregate([
    {
      $group: {
        _id: "$url",
        count: { $sum: 1 },
        docs: { $push: { id: "$_id", fetchedAt: "$fetchedAt" } },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]);

  for (const duplicate of duplicateResults) {
    const sortedDocs = duplicate.docs.sort(
      (a: any, b: any) =>
        new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime(),
    );
    const toDelete = sortedDocs.slice(1);

    if (!dryRun) {
      const deleteResult = await Article.deleteMany({
        _id: { $in: toDelete.map((doc: any) => doc.id) },
      });
      stats.duplicatesRemoved += deleteResult.deletedCount || 0;
    } else {
      stats.duplicatesRemoved += toDelete.length;
    }
  }
  console.log(
    `Phase 1 complete. Duplicates removed: ${stats.duplicatesRemoved}`,
  );

  console.log(
    "Phase 2: Removing articles older than 90 days with low engagement...",
  );
  const oldArticlesCriteria = {
    fetchedAt: { $lt: cutoffDate90 },
    $or: [
      { summary: { $exists: false } },
      { summary: "" },
      { topics: { $size: 0 } },
      { content: { $regex: /^.{0,500}$/s } },
    ],
  };

  if (!dryRun) {
    const oldResult = await Article.deleteMany(oldArticlesCriteria);
    stats.oldArticlesRemoved = oldResult.deletedCount || 0;
  } else {
    stats.oldArticlesRemoved =
      await Article.countDocuments(oldArticlesCriteria);
  }
  console.log(
    `Phase 2 complete. Old articles removed: ${stats.oldArticlesRemoved}`,
  );

  console.log("Phase 3: Removing low-quality articles...");
  const lowQualityCriteria = {
    $or: [
      { content: { $exists: false } },
      { content: "" },
      { content: { $regex: /^.{0,299}$/s } },
      { title: { $exists: false } },
      { title: "" },
      { title: { $regex: /^.{0,9}$/s } },
      { title: { $regex: /^(untitled|no title|404|error|page not found)$/i } },
      {
        $and: [
          {
            content: {
              $regex:
                /(sorry|unable to|can't|cannot).{0,50}(access|load|fetch|retrieve)/i,
            },
          },
          { fetchedAt: { $lt: cutoffDate30 } },
        ],
      },
    ],
  };

  if (!dryRun) {
    const lowQualityResult = await Article.deleteMany(lowQualityCriteria);
    stats.lowQualityRemoved = lowQualityResult.deletedCount || 0;
  } else {
    stats.lowQualityRemoved = await Article.countDocuments(lowQualityCriteria);
  }
  console.log(
    `Phase 3 complete. Low-quality articles removed: ${stats.lowQualityRemoved}`,
  );

  console.log("Phase 4: Removing orphaned/malformed articles...");
  const orphanedCriteria = {
    $or: [
      { url: { $exists: false } },
      { url: "" },
      { source: { $exists: false } },
      { source: "" },
      { fetchedAt: { $exists: false } },
      {
        url: {
          $regex:
            /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json|xml|webmanifest|pdf|zip|gz)$/i,
        },
      },
    ],
  };

  if (!dryRun) {
    const orphanedResult = await Article.deleteMany(orphanedCriteria);
    stats.orphanedRemoved = orphanedResult.deletedCount || 0;
  } else {
    stats.orphanedRemoved = await Article.countDocuments(orphanedCriteria);
  }
  console.log(
    `Phase 4 complete. Orphaned articles removed: ${stats.orphanedRemoved}`,
  );

  stats.articlesRemoved =
    stats.duplicatesRemoved +
    stats.oldArticlesRemoved +
    stats.lowQualityRemoved +
    stats.orphanedRemoved;

  const finalCount = stats.totalArticles - stats.articlesRemoved;

  console.log("\n=== PRUNING SUMMARY ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Total articles before: ${stats.totalArticles}`);
  console.log(`Total articles after: ${finalCount}`);
  console.log(`Articles removed: ${stats.articlesRemoved}`);
  console.log(`- Duplicates: ${stats.duplicatesRemoved}`);
  console.log(`- Old low-engagement: ${stats.oldArticlesRemoved}`);
  console.log(`- Low-quality: ${stats.lowQualityRemoved}`);
  console.log(`- Orphaned/malformed: ${stats.orphanedRemoved}`);
  console.log(
    `Space saved: ${Math.round((stats.articlesRemoved / stats.totalArticles) * 100)}%`,
  );

  if (dryRun) {
    console.log("\nThis was a dry run. No articles were actually deleted.");
    console.log("Run with --live flag to execute the pruning.");
  }

  await mongoose.disconnect();
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--live");

  if (dryRun) {
    console.log(
      "Running in DRY RUN mode. Use --live flag to actually delete articles.\n",
    );
  } else {
    console.log(
      "Running in LIVE mode. Articles will be permanently deleted.\n",
    );

    if (!args.includes("--force")) {
      console.log("Are you sure? This action cannot be undone.");
      console.log("Add --force flag to confirm deletion.");
      process.exit(1);
    }
  }

  try {
    await pruneArticles(dryRun);
    console.log("\nPruning completed successfully ✅");
  } catch (error) {
    console.error("Pruning failed ❌", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { pruneArticles };
