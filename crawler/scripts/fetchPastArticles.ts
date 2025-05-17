#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import axios, { AxiosError } from "axios";
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import mongoose, { Schema, model } from "mongoose";
import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

/* ─────────── Mongo schema ─────────── */
const ArticleSchema = new Schema({
  url: { type: String, unique: true, index: true },
  title: String,
  content: String,
  summary: String,
  topics: [String],
  source: String,
  fetchedAt: Date,
});
const Article = model("Article", ArticleSchema);

/* ─────────── ENV ─────────── */
const {
  MONGODB_URI = "",
  NEWS_API_KEY,
  NEWS_API_KEY1,
  NEWS_API_KEY2,
  NEWS_API_KEY3,
  NEWS_API_KEY4,
  NEWS_API_KEY5,
  NEWS_API_KEY6,
  NEWS_API_KEY7,
  CRAWL_URLS = "",
  AI_INSTRUCTIONS = "Summarize concisely",
  GOOGLE_AI_API_KEY,
  GOOGLE_AI_API_KEY1,
  GOOGLE_AI_API_KEY2,
  GOOGLE_AI_API_KEY3,
} = process.env;

if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

const NEWS_KEYS = [
  NEWS_API_KEY,
  NEWS_API_KEY1,
  NEWS_API_KEY2,
  NEWS_API_KEY3,
  NEWS_API_KEY4,
  NEWS_API_KEY5,
  NEWS_API_KEY6,
  NEWS_API_KEY7,
].filter(Boolean) as string[];
if (!NEWS_KEYS.length) throw new Error("No NEWS_API_KEY* provided");

const HOMEPAGES = CRAWL_URLS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ─────────── constants ─────────── */
const CRAWL_CONCURRENCY = 3;
const FETCH_CONCURRENCY = 5;
const STATIC_TIMEOUT_MS = 60_000;
const BROWSER_TIMEOUT = 30_000;
const LOOP_INTERVAL_MS = 10 * 60_000; // each back‑fill loop sleeps 10 min

/* ─────────── filters ─────────── */
const POLI_RE =
  /politic|congress|senate|house-|whitehouse|election|governor|campaign/i;
const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|eot|ttf|otf|json|webmanifest|xml|rss|atom|mp4|mpeg|mov|zip|gz|pdf)(\?|$)/i;

/* ─────────── helpers ─────────── */

/**
 * Sleep for a given number of milliseconds.
 *
 * @param ms - The number of milliseconds to sleep.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Convert a Date object to an ISO 8601 string.
 *
 * @param d - The Date object to convert.
 * @returns The ISO 8601 string representation of the date.
 */
const iso = (d: Date) => d.toISOString().split(".")[0] + "Z";

/* ─────────── Gemini helpers (unchanged logic) ─────────── */
const AI_KEYS = [
  GOOGLE_AI_API_KEY,
  GOOGLE_AI_API_KEY1,
  GOOGLE_AI_API_KEY2,
  GOOGLE_AI_API_KEY3,
].filter(Boolean) as string[];
const AI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];
const AI_RETRIES = 2;

/**
 * Generate content using Google Generative AI.
 *
 * @param prompt - The prompt to generate content for.
 * @param system - The system instruction for the model.
 * @param maxOut - The maximum output tokens.
 */
async function gemini(
  prompt: string,
  system: string,
  maxOut: number,
): Promise<string> {
  for (const key of AI_KEYS)
    for (const model of AI_MODELS) {
      const g = new GoogleGenerativeAI(key).getGenerativeModel({
        model,
        systemInstruction: system,
      });
      for (let i = 0; i < AI_RETRIES; i++) {
        try {
          const res = await g.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: maxOut,
            } as GenerationConfig,
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
              },
            ],
          });
          const out = res.response?.text?.().trim();
          if (out) return out;
        } catch (e: any) {
          if (/429|overload|quota|503/i.test(e.message) && i < AI_RETRIES - 1)
            await sleep(1500 * (i + 1));
        }
      }
    }
  return "";
}

/**
 * Summarize text using Google Generative AI.
 *
 * @param txt - The text to summarize.
 */
const summarizeAI = (txt: string) =>
  gemini(`Summarize:\n${txt.slice(0, 5000)}`, AI_INSTRUCTIONS, 1024);

/**
 * Extract topics from text using Google Generative AI.
 *
 * @param txt - The text to extract topics from.
 */
const topicsAI = async (txt: string) =>
  gemini(
    `Give 5‑10 concise topics (comma‑separated, no quotes) for:\n${txt.slice(
      0,
      2000,
    )}`,
    "",
    256,
  ).then((o) =>
    Array.from(
      new Set(
        o
          .split(/[,|\n]+/)
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
  );

/* ─────────── Fetch helpers ─────────── */

/**
 * Fetch static content from a URL.
 *
 * @param url - The URL to fetch.
 */
async function fetchStatic(url: string) {
  const { data } = await axios.get(url, { timeout: STATIC_TIMEOUT_MS });
  const title = (data.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? "").trim();
  const text = data
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, content: text };
}

/**
 * Fetch dynamic content from a URL using Puppeteer.
 *
 * @param url - The URL to fetch.
 * @param browser - The Puppeteer browser instance.
 */
async function fetchDynamic(url: string, browser: Browser) {
  const p = await browser.newPage();
  await p.goto(url, {
    timeout: BROWSER_TIMEOUT,
    waitUntil: "domcontentloaded",
  });
  const title = await p.title();
  const content = await p.evaluate(() => document.body.innerText);
  await p.close();
  return { title, content };
}

/* ─────────── crawl helper ─────────── */

/**
 * Crawl a homepage for links to articles.
 *
 * @param u - The URL of the homepage to crawl.
 */
async function crawlHomepage(u: string): Promise<string[]> {
  const queue = [u];
  const seen = new Set<string>();
  const out: string[] = [];
  while (queue.length && out.length < 50) {
    const cur = queue.shift()!;
    if (
      seen.has(cur) ||
      STATIC_EXT_RE.test(cur) ||
      cur.includes("#") ||
      !cur.startsWith("http")
    )
      continue;
    seen.add(cur);
    if (POLI_RE.test(cur)) out.push(cur);
    if (out.length >= 50) break;
    try {
      const { data } = await axios.get(cur, { timeout: STATIC_TIMEOUT_MS });
      const links = [...data.matchAll(/href=["']([^"']+)["']/g)]
        .map((m) => new URL(m[1], cur).href)
        .filter(
          (l) => POLI_RE.test(l) && !STATIC_EXT_RE.test(l) && !l.includes("#"),
        );
      queue.push(...links);
    } catch {}
  }
  return out;
}

/* ─────────── ingest ─────────── */
const working = new Set<string>();

/**
 * Ingest an article from a URL.
 *
 * @param url - The URL of the article to ingest.
 * @param browser - The Puppeteer browser instance.
 */
async function ingest(url: string, browser: Browser) {
  if (
    working.has(url) ||
    STATIC_EXT_RE.test(url) ||
    url.includes("#") ||
    !POLI_RE.test(url)
  )
    return;
  working.add(url);
  try {
    if (await Article.exists({ url })) return;
    let art;
    try {
      art = await fetchStatic(url);
      if (art.content.length < 300) throw new Error("thin static → dyn");
    } catch {
      art = await fetchDynamic(url, browser);
    }
    if (art.content.length < 200) return;

    const summary =
      (await summarizeAI(art.content)) || art.content.slice(0, 400) + "…";
    const topics = await topicsAI(summary);

    await Article.updateOne(
      { url },
      {
        $setOnInsert: {
          ...art,
          summary,
          topics,
          source: new URL(url).hostname,
          fetchedAt: new Date(),
        },
      },
      { upsert: true },
    );
    console.log("✓", url);
  } catch (e: any) {
    console.warn("⚠", url, e.message);
  } finally {
    working.delete(url);
  }
}

/* ─────────── NewsAPI iterator (back‑fill, key rotation) ─────────── */

/**
 * NewsAPI iterator to fetch articles.
 *
 * @returns An async generator yielding article URLs.
 */
async function* newsApiIterator(): AsyncGenerator<{ url: string }, void, void> {
  let to = new Date(); // walk back from "now"
  let keyIdx = 0;

  const QUERY = `"us politics" OR congress OR senate OR president OR election AND NOT sports`;

  while (true) {
    let page = 1;
    let lastPublished = "";

    while (true) {
      const params = new URLSearchParams({
        q: QUERY,
        language: "en",
        sortBy: "publishedAt",
        pageSize: "100",
        page: String(page),
        to: iso(to),
        apiKey: NEWS_KEYS[keyIdx],
      });

      try {
        const { data } = await axios.get(
          `https://newsapi.org/v2/everything?${params}`,
        );
        if (data.status !== "ok" || !data.articles?.length) break;

        for (const art of data.articles) {
          if (!STATIC_EXT_RE.test(art.url) && POLI_RE.test(art.url)) yield art;
        }

        lastPublished = data.articles[data.articles.length - 1].publishedAt;
        if (data.articles.length < 100) break;
        page++;
        await sleep(1100);
      } catch (err) {
        const ax = err as AxiosError<any>;
        const status = ax.response?.status || 0;
        const apiCode = (ax.response?.data as any)?.code ?? "";

        if (status === 426 && apiCode === "maximumResultsReached") {
          // NewsAPI free tier limit; slide window back & restart this key
          if (lastPublished) {
            to = new Date(Date.parse(lastPublished) - 1_000);
            break;
          }
        } else if (status === 401 || status === 429) {
          keyIdx = (keyIdx + 1) % NEWS_KEYS.length;
          console.warn(`🔑 rotate NewsAPI key → ${keyIdx}`);
          // if we've looped over all keys once, sleep 60s to avoid spin
          if (keyIdx === 0) await sleep(60_000);
          continue;
        } else {
          console.warn("NewsAPI error", status || err);
          await sleep(30_000);
        }
        break;
      }
    }

    // step window back one day to keep moving
    to = new Date(to.getTime() - 24 * 60 * 60_000);
  }
}

/* ─────────── infinite back‑fill loop ─────────── */

/**
 * Main function to run the crawler.
 * Note: This is designed to run infinitely in a loop to
 * continuously crawl and fetch articles, delving deeper
 * and deeper into the past.
 */
async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Mongo connected");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  while (true) {
    const loopStart = Date.now();

    // a) NewsAPI historical
    for await (const art of newsApiIterator()) ingest(art.url, browser);

    // b) Crawl configured homepages
    for (let i = 0; i < HOMEPAGES.length; i += CRAWL_CONCURRENCY) {
      await Promise.all(
        HOMEPAGES.slice(i, i + CRAWL_CONCURRENCY).map(async (hp) => {
          const links = await crawlHomepage(hp);
          for (let j = 0; j < links.length; j += FETCH_CONCURRENCY) {
            await Promise.all(
              links
                .slice(j, j + FETCH_CONCURRENCY)
                .map((l) => ingest(l, browser)),
            );
          }
        }),
      );
    }

    // wait for stragglers
    while (working.size) await sleep(1000);

    // sleep remainder
    const elapsed = Date.now() - loopStart;
    if (elapsed < LOOP_INTERVAL_MS) await sleep(LOOP_INTERVAL_MS - elapsed);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
