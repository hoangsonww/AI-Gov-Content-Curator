#!/usr/bin/env ts-node

/**
 * schedule/fetchAndSummarize.ts
 *
 * End‑to‑end pipeline:
 *  1. Crawl homepages (BFS, depth/link bounded)
 *  2. Pull headlines from NewsAPI
 *  3. De‑dupe (DB + in‑process)
 *  4. Fetch full article (static → dynamic)
 *  5. Summarize + topic‑tag (key/model rotation)
 *  6. Upsert into Mongo
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Article from "../models/article.model";
import {
  ArticleData,
  crawlArticlesFromHomepage,
  fetchStaticArticle,
  fetchDynamicArticle,
} from "../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../services/apiFetcher.service";
import { summarizeContent } from "../services/summarization.service";
import { extractTopics } from "../services/topicExtractor.service";
import logger from "../utils/logger";
import { cleanUp } from "../scripts/cleanData";
import { calculateSourceScore } from "../services/sourceScoring.service";

dotenv.config();
mongoose.set("strictQuery", false);

/* ─────────────────── ENV / CONFIG ─────────────────── */

const MONGODB_URI = process.env.MONGODB_URI ?? "";
if (!MONGODB_URI) throw new Error("MONGODB_URI must be defined");

const HOMEPAGE_URLS = (process.env.CRAWL_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const CRAWL_MAX_LINKS = parseInt(process.env.CRAWL_MAX_LINKS ?? "40", 10);
const CRAWL_MAX_DEPTH = parseInt(process.env.CRAWL_MAX_DEPTH ?? "2", 10);
const CRAWL_CONCURRENCY = parseInt(process.env.CRAWL_CONCURRENCY ?? "3", 10);
const FETCH_CONCURRENCY = parseInt(process.env.FETCH_CONCURRENCY ?? "5", 10);
const DELAY_BETWEEN_REQUESTS_MS = parseInt(
  process.env.DELAY_BETWEEN_REQUESTS_MS ?? "1000",
  10,
);
const MAX_FETCH_TIME_MS = parseInt(
  process.env.MAX_FETCH_TIME_MS ?? "60000",
  10,
);

const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|eot|ttf|otf|json|webmanifest|xml|rss|atom|mp4|mpeg|mov|zip|gz|pdf)(\?|$)/i;

// Wait time between requests to avoid overwhelming the server
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upsert article into MongoDB
 *
 * @param data - Article data to be upserted
 */
async function upsertArticle(data: {
  url: string;
  title: string;
  content: string;
  summary: string;
  topics: string[];
  source: string;
  sourceScore: number;
}) {
  const res = await Article.updateOne(
    { url: data.url },
    { $setOnInsert: { ...data, fetchedAt: new Date() } },
    { upsert: true },
  );

  if (res.upsertedCount) {
    logger.info(`✅ Saved: ${data.title || data.url}`);
  } else {
    logger.debug(`🔄 Skipped duplicate: ${data.url}`);
  }
}

/* ─────────────────── IN‑MEMORY CONCURRENCY GUARD ─────────────────── */

const processingUrls = new Set<string>();

/**
 * Start processing a URL
 *
 * @param url - The URL to process
 * @returns true if the URL was not already being processed, false otherwise
 */
function startProcessing(url: string): boolean {
  if (processingUrls.has(url)) return false;
  processingUrls.add(url);
  return true;
}

/**
 * Mark a URL as done processing
 *
 * @param url - The URL that has finished processing
 */
function doneProcessing(url: string) {
  processingUrls.delete(url);
}

/* ─────────────────── NEWS‑API ARTICLES ─────────────────── */

/**
 * Process an article from the NewsAPI
 *
 * @param api - The article data from the API
 */
async function processApiArticle(api: {
  url: string;
  title?: string;
  description?: string;
  content?: string;
  source?: { name?: string };
}) {
  if (
    STATIC_EXT_RE.test(api.url) ||
    api.url.includes("#") ||
    !startProcessing(api.url)
  )
    return;

  try {
    const text = (api.content || api.description || "").trim();
    if (!text) {
      logger.warn(`API article ${api.url} has no text`);
      return;
    }

    const summary = await summarizeContent(text);
    const topics = await extractTopics(summary);
    const sourceScore = calculateSourceScore(api.url);

    await upsertArticle({
      url: api.url,
      title: api.title ?? "(no title)",
      content: text,
      summary,
      topics,
      source: api.source?.name ?? "newsapi",
      sourceScore,
    });
  } catch (err) {
    logger.error(`Error processing API article ${api.url}:`, err);
  } finally {
    doneProcessing(api.url);
  }
}

/* ─────────────────── PAGE‑FETCH ARTICLES ─────────────────── */

/**
 * Process a URL to fetch and summarize its content
 *
 * @param url - The URL to process
 */
async function processUrl(url: string): Promise<void> {
  if (STATIC_EXT_RE.test(url) || url.includes("#") || !startProcessing(url))
    return;

  try {
    // 1) Static fetch (with timeout) → dynamic fallback
    let art: ArticleData;
    try {
      art = await Promise.race([
        fetchStaticArticle(url),
        new Promise<never>((_, r) =>
          setTimeout(() => r(new Error("static timeout")), MAX_FETCH_TIME_MS),
        ),
      ]);
    } catch (e) {
      logger.warn(`static FAIL ${url}: ${e}. Trying dynamic.`);
      art = await fetchDynamicArticle(url);
    }

    if (!art.content.trim()) {
      logger.warn(`No content ${url}`);
      return;
    }

    // 2) Summarize + topics
    const summary = await summarizeContent(art.content);
    const topics = await extractTopics(summary);
    const sourceScore = calculateSourceScore(art.url);

    // 3) Upsert
    await upsertArticle({
      url: art.url,
      title: art.title,
      content: art.content,
      summary,
      topics,
      source: art.source,
      sourceScore,
    });

    await wait(DELAY_BETWEEN_REQUESTS_MS);
  } catch (err) {
    logger.error(`Full‑article pipeline failed ${url}:`, err);
  } finally {
    doneProcessing(url);
  }
}

/* ─────────────────── MAIN ─────────────────── */

/**
 * Main function to fetch and summarize articles
 *
 * @returns Promise<void>
 */
export async function fetchAndSummarize(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  logger.info("✅ Mongo connected");

  /* 1. Crawl homepages */
  logger.info("🔍 Crawling homepages...");
  const crawlJobs: Promise<string[]>[] = [];
  for (let i = 0; i < HOMEPAGE_URLS.length; i += CRAWL_CONCURRENCY) {
    crawlJobs.push(
      ...HOMEPAGE_URLS.slice(i, i + CRAWL_CONCURRENCY).map((u) =>
        crawlArticlesFromHomepage(u, CRAWL_MAX_LINKS, CRAWL_MAX_DEPTH),
      ),
    );
  }
  const crawledRaw = (await Promise.all(crawlJobs)).flat();
  const crawled = crawledRaw.filter(
    (u) => !STATIC_EXT_RE.test(u) && !u.includes("#"),
  );
  logger.info(`🔗 Crawled ${crawled.length} links`);

  /* 2. NewsAPI */
  logger.info("📰 Pulling NewsAPI...");
  let apiArticles: any[] = [];
  try {
    apiArticles = await fetchArticlesFromNewsAPI();
  } catch (err) {
    logger.error("NewsAPI error:", err);
  }

  /* 3. Process API articles */
  await Promise.allSettled(apiArticles.map(processApiArticle));

  /* 4. Build list for page‑fetch */
  const allUrls = Array.from(
    new Set([...crawled, ...apiArticles.map((a) => a.url)]),
  );

  // Remove already‑in‑DB URLs (fast indexed query)
  const already = await Article.find({ url: { $in: allUrls } }, "url").lean();
  const alreadySet = new Set(already.map((d) => d.url));
  const toFetch = allUrls.filter((u) => !alreadySet.has(u));
  logger.info(`🆕 ${toFetch.length} fresh URLs to page‑fetch`);

  /* 5. Page fetch in limited‑size batches */
  for (let i = 0; i < toFetch.length; i += FETCH_CONCURRENCY) {
    const slice = toFetch.slice(i, i + FETCH_CONCURRENCY);
    await Promise.allSettled(slice.map(processUrl));
  }

  /* 6. Wait for any stragglers */
  while (processingUrls.size) {
    logger.debug(`⏳ waiting for ${processingUrls.size} in‑flight jobs...`);
    await wait(1000);
  }

  /* 7. Clean up */
  logger.info("🧹 Cleaning up...");
  await cleanUp();

  logger.info("🏁 Pipeline complete");
}

// CLI entry point
if (require.main === module) {
  fetchAndSummarize()
    .then(() => {
      logger.info("🎉 fetchAndSummarize finished");
      process.exit(0);
    })
    .catch((err) => {
      logger.error("💥 fetchAndSummarize crashed:", err);
      process.exit(1);
    });
}
