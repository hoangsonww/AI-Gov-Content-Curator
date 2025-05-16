#!/usr/bin/env ts-node

/**
 * schedule/fetchAndSummarize.ts
 *
 * A high-throughput, concurrency-optimized job that:
 *  1. Crawls configured homepages for article links (BFS up to depth)
 *  2. Fetches trusted news articles via NewsAPI
 *  3. Deduplicates and filters out already-saved URLs
 *  4. Fetches each new article (static first, dynamic fallback) with timeout
 *  5. Summarizes via Google Generative AI (with retry)
 *  6. Extracts topics
 *  7. Saves to MongoDB
 *
 * Concurrency is controlled via environment variables for:
 *  - homepage crawling
 *  - article fetching/summarization
 *
 * Usage: `ts-node schedule/fetchAndSummarize.ts` or invoked by your scheduler/CRON.
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Article from "../models/article.model";
import {
  ArticleData,
  crawlArticlesFromHomepage,
  fetchStaticArticle,
} from "../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../services/apiFetcher.service";
import { summarizeContent } from "../services/summarization.service";
import { extractTopics } from "../services/topicExtractor.service";
import logger from "../utils/logger";

dotenv.config();
mongoose.set("strictQuery", false);

// Environment / configuration
const MONGODB_URI: string = process.env.MONGODB_URI ?? "";
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI must be defined");
}

const HOMEPAGE_URLS: string[] = (process.env.CRAWL_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter((u) => u.length > 0);

const CRAWL_MAX_LINKS: number = parseInt(
  process.env.CRAWL_MAX_LINKS ?? "40",
  10,
);
const CRAWL_MAX_DEPTH: number = parseInt(
  process.env.CRAWL_MAX_DEPTH ?? "2",
  10,
);
const CRAWL_CONCURRENCY: number = parseInt(
  process.env.CRAWL_CONCURRENCY ?? "3",
  10,
);

const FETCH_CONCURRENCY: number = parseInt(
  process.env.FETCH_CONCURRENCY ?? "5",
  10,
);
const DELAY_BETWEEN_REQUESTS_MS: number = parseInt(
  process.env.DELAY_BETWEEN_REQUESTS_MS ?? "1000",
  10,
);
const MAX_FETCH_TIME_MS: number = parseInt(
  process.env.MAX_FETCH_TIME_MS ?? "20000",
  10,
);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Fetch, summarize, extract topics, and save one URL.
 */
async function processUrl(url: string): Promise<void> {
  try {
    // Fetch article (static with built-in dynamic fallback)
    const articleData: ArticleData = await Promise.race([
      fetchStaticArticle(url),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Fetch timeout")), MAX_FETCH_TIME_MS),
      ),
    ]);

    if (!articleData.content.trim()) {
      logger.warn(`Empty content for ${url}, skipping.`);
      return;
    }

    // Summarize
    let summary: string;
    try {
      summary = await summarizeContent(articleData.content);
    } catch (err) {
      logger.error(`Summarization failed for ${url}:`, err);
      return;
    }

    // Extract topics
    let topics: string[] = [];
    try {
      topics = await extractTopics(summary);
    } catch (err) {
      logger.error(`Topic extraction failed for ${url}:`, err);
    }

    // Persist to MongoDB
    const doc = new Article({
      url: articleData.url,
      title: articleData.title,
      content: articleData.content,
      summary,
      topics,
      source: articleData.source,
      fetchedAt: new Date(),
    });
    await doc.save();
    logger.info(`✅ Saved article: ${doc.title}`);

    // Throttle if desired
    await delay(DELAY_BETWEEN_REQUESTS_MS);
  } catch (err: any) {
    if (err.code === 11000) {
      logger.warn(`Duplicate URL ${url}, skipping.`);
    } else {
      logger.error(`Error processing ${url}:`, err);
    }
  }
}

/**
 * Main entrypoint.
 */
export async function fetchAndSummarize(): Promise<void> {
  // 1) Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  // 2) Crawl homepages in parallel (batched by concurrency)
  logger.info("🔍 Starting homepage crawl...");
  const crawlBatches: Promise<string[]>[] = [];
  for (let i = 0; i < HOMEPAGE_URLS.length; i += CRAWL_CONCURRENCY) {
    const batch = HOMEPAGE_URLS.slice(i, i + CRAWL_CONCURRENCY);
    crawlBatches.push(
      ...batch.map((url) =>
        crawlArticlesFromHomepage(url, CRAWL_MAX_LINKS, CRAWL_MAX_DEPTH),
      ),
    );
  }
  const crawledResults = await Promise.all(crawlBatches);
  const crawledUrls = crawledResults.flat();
  logger.info(`🔗 Crawled ${crawledUrls.length} links`);

  // 3) Fetch from NewsAPI
  logger.info("📰 Fetching from NewsAPI...");
  let apiArticles: Array<{ url: string }> = [];
  try {
    apiArticles = await fetchArticlesFromNewsAPI();
  } catch (err) {
    logger.error("Failed to fetch from NewsAPI:", err);
  }
  const apiUrls: string[] = apiArticles.map((a) => a.url);

  // 4) Dedupe and filter out existing
  const allUrls = Array.from(new Set([...crawledUrls, ...apiUrls]));
  logger.info(`🔍 Total unique URLs: ${allUrls.length}`);

  const existing = await Article.find({ url: { $in: allUrls } }, "url").lean();
  const existingSet = new Set(existing.map((d) => d.url));
  const newUrls = allUrls.filter((u) => !existingSet.has(u));
  logger.info(`🆕 New URLs to process: ${newUrls.length}`);

  // 5) Process new URLs in batches
  logger.info("⚙️  Processing articles...");
  for (let i = 0; i < newUrls.length; i += FETCH_CONCURRENCY) {
    const batch = newUrls.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(batch.map((url) => processUrl(url)));
  }

  logger.info("✅ All done!");
}

// Run if invoked directly
if (require.main === module) {
  fetchAndSummarize()
    .then(() => {
      logger.info("🎉 fetchAndSummarize completed.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error("💥 fetchAndSummarize failed:", err);
      process.exit(1);
    });
}
