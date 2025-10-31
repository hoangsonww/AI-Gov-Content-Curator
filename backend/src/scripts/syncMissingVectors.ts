#!/usr/bin/env ts-node

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Article from "../models/article.model";
import { upsertArticleVector } from "../services/pinecone.service";
import { Pinecone } from "@pinecone-database/pinecone";

const MONGODB_URI = process.env.MONGODB_URI || "";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 2000;

async function getVectorizedIds(): Promise<Set<string>> {
  if (!process.env.PINECONE_API_KEY) {
    console.warn("PINECONE_API_KEY not configured");
    return new Set();
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = process.env.PINECONE_INDEX || "ai-gov-articles";
  const index = pinecone.index(indexName);

  const vectorizedIds = new Set<string>();

  // Fetch all vector IDs from Pinecone
  console.log("Fetching all vector IDs from Pinecone...");

  try {
    const stats = await index.describeIndexStats();
    const totalVectors = stats.totalRecordCount || 0;
    console.log(`Total vectors in Pinecone: ${totalVectors}`);

    // List all vectors with proper pagination (max limit is 100)
    let paginationToken: string | undefined = undefined;
    let pageCount = 0;
    let listResponse;

    do {
      listResponse = await index.listPaginated({
        limit: 100,
        paginationToken,
      });

      pageCount++;

      if (listResponse.vectors) {
        for (const vector of listResponse.vectors) {
          if (vector.id) {
            vectorizedIds.add(vector.id);
          }
        }
      }

      paginationToken = listResponse.pagination?.next;

      if (pageCount % 10 === 0) {
        console.log(`  Fetched ${vectorizedIds.size} vector IDs so far...`);
      }
    } while (paginationToken);

    console.log(`Found ${vectorizedIds.size} vector IDs in Pinecone`);
  } catch (error: any) {
    console.error("Error fetching Pinecone vectors:", error.message);
  }

  return vectorizedIds;
}

async function syncMissingVectors() {
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

  // Get all vectorized IDs from Pinecone
  const vectorizedIds = await getVectorizedIds();

  // Get all article IDs from MongoDB
  const allArticles = await Article.find(
    {},
    "_id url title summary topics source fetchedAt",
  ).lean();
  console.log(`Total articles in MongoDB: ${allArticles.length}`);

  // Find articles that are not in Pinecone
  const missingArticles = allArticles.filter(
    (article) => !vectorizedIds.has(article._id.toString()),
  );

  console.log(`\nArticles missing from Pinecone: ${missingArticles.length}`);

  if (missingArticles.length === 0) {
    console.log("✓ All articles are already vectorized!");
    await mongoose.disconnect();
    process.exit(0);
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < missingArticles.length; i += BATCH_SIZE) {
    const batch = missingArticles.slice(i, i + BATCH_SIZE);

    console.log(
      `\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + batch.length, missingArticles.length)} of ${missingArticles.length})`,
    );

    for (const article of batch) {
      try {
        await upsertArticleVector({
          id: article._id.toString(),
          url: article.url,
          title: article.title,
          summary: article.summary || article.content?.substring(0, 500) || "",
          topics: article.topics || [],
          source: article.source,
          fetchedAt: article.fetchedAt,
        });

        processed++;
        succeeded++;

        if (processed % 10 === 0) {
          console.log(`  Progress: ${processed}/${missingArticles.length}`);
        }

        // Small delay between each upsert to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(
          `  ✗ Failed to vectorize article ${article._id}:`,
          error.message,
        );
        failed++;
        processed++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < missingArticles.length) {
      console.log(
        `  Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS),
      );
    }
  }

  console.log(`\n✓ Sync complete!`);
  console.log(`  Total processed: ${processed}`);
  console.log(`  Successful: ${succeeded}`);
  console.log(`  Failed: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

syncMissingVectors().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
