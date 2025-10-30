#!/usr/bin/env ts-node

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Article from "../models/article.model";
import { upsertArticleVector } from "../services/pinecone.service";

const MONGODB_URI = process.env.MONGODB_URI || "";
const BATCH_SIZE = 50;

async function vectorizeAllArticles() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is required");
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("GOOGLE_AI_API_KEY is required");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const totalArticles = await Article.countDocuments();
  console.log(`Found ${totalArticles} articles to vectorize`);

  let processed = 0;
  let failed = 0;

  while (processed < totalArticles) {
    const articles = await Article.find()
      .skip(processed)
      .limit(BATCH_SIZE)
      .lean();

    console.log(
      `\nProcessing batch ${Math.floor(processed / BATCH_SIZE) + 1} (${processed + 1}-${Math.min(processed + articles.length, totalArticles)} of ${totalArticles})`,
    );

    for (const article of articles) {
      try {
        await upsertArticleVector({
          id: article._id.toString(),
          url: article.url,
          title: article.title,
          summary: article.summary || article.content.substring(0, 500),
          topics: article.topics || [],
          source: article.source,
          fetchedAt: article.fetchedAt,
        });
        processed++;
      } catch (error: any) {
        console.error(
          `Failed to vectorize article ${article._id}:`,
          error.message,
        );
        failed++;
        processed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✓ Vectorization complete!`);
  console.log(`  Total: ${totalArticles}`);
  console.log(`  Successful: ${processed - failed}`);
  console.log(`  Failed: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

vectorizeAllArticles().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
