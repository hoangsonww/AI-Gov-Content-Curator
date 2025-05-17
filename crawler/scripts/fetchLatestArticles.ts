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
if (!NEWS_KEYS.length) throw new Error("No NEWS_API_KEY* found");

/* ─────────── constants ─────────── */
const HOMEPAGES = CRAWL_URLS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CRAWL_CONCURRENCY = 3;
const FETCH_CONCURRENCY = 5;
const STATIC_TIMEOUT_MS = 60_000;
const BROWSER_TIMEOUT = 30_000;

const NEWS_POLL_EVERY_MS = 60_000; // fresh headlines every minute
const CRAWL_EVERY_MS = 10 * 60_000; // homepage crawl every 10 min

/* ─────────── filters ─────────── */
const POLI_RE =
  /politic|congress|senate|house-|whitehouse|election|governor|campaign/i;
const STATIC_RE =
  /\.(png|jpe?g|gif|svg|ico|webp|css|js|woff2?|ttf|eot|json|xml|webmanifest)(\?|$)/i;

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

/* ─────────── Gemini helpers (unchanged) ─────────── */
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
 * Fetch a summary from Gemini AI.
 *
 * @param prompt - The prompt to send to the AI.
 * @param system - The system instruction for the AI.
 * @param maxOut - The maximum number of output tokens.
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
 * Summarize a given text using Gemini AI.
 *
 * @param t - The text to summarize.
 */
const summarizeAI = (t: string) =>
  gemini(`Summarize:\n${t.slice(0, 5000)}`, AI_INSTRUCTIONS, 1024);

/**
 * Generate topics for a given text using Gemini AI.
 *
 * @param t - The text to generate topics for.
 */
const topicsAI = async (t: string) =>
  gemini(
    `Give 5‑10 concise topics (comma‑separated, no quotes) for:\n${t.slice(0, 2000)}`,
    "",
    512,
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

/* ─────────── Crawl helpers ─────────── */

/**
 * Crawl a homepage for links to articles.
 *
 * @param url - The URL of the homepage to crawl.
 */
async function crawlHomepage(url: string): Promise<string[]> {
  const queue = [url];
  const seen = new Set<string>();
  const out: string[] = [];

  while (queue.length && out.length < 50) {
    const cur = queue.shift()!;
    if (
      seen.has(cur) ||
      STATIC_RE.test(cur) ||
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
          (l) => POLI_RE.test(l) && !STATIC_RE.test(l) && !l.includes("#"),
        );
      queue.push(...links);
    } catch {}
  }
  return out;
}

/* ─────────── ingest pipeline ─────────── */
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
    STATIC_RE.test(url) ||
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

/* ─────────── NewsAPI polling loop (fresh) ─────────── */

/**
 * Poll the NewsAPI for fresh articles.
 *
 * @param browser - The Puppeteer browser instance.
 */
async function newsLoop(browser: Browser) {
  let lastChecked = new Date(Date.now() - 5 * 60_000); // start 5 min back
  let keyIdx = 0; // current NewsAPI key

  const QUERY = `"us politics" OR congress OR senate OR president OR election AND NOT sports`;

  while (true) {
    const now = new Date();
    let page = 1;
    let round = 0; // # keys tried in this poll cycle

    while (page <= 5) {
      const params = new URLSearchParams({
        q: QUERY,
        language: "en",
        sortBy: "publishedAt",
        pageSize: "100",
        page: String(page),
        from: iso(lastChecked),
        to: iso(now),
        apiKey: NEWS_KEYS[keyIdx],
      });

      try {
        const { data } = await axios.get(
          `https://newsapi.org/v2/everything?${params}`,
        );

        if (data.status !== "ok" || !data.articles?.length) break;

        for (const art of data.articles) {
          if (!STATIC_RE.test(art.url) && POLI_RE.test(art.url)) {
            ingest(art.url, browser);
          }
        }

        if (data.articles.length < 100) break;
        page++;
        await sleep(1100);
      } catch (err) {
        const ax = err as AxiosError<any>;
        const status = ax.response?.status || 0;
        const code = (ax.response?.data as any)?.code ?? "";

        // rotate key only on 401 / 429 (quota, auth, rate)
        if (status === 401 || status === 429) {
          keyIdx = (keyIdx + 1) % NEWS_KEYS.length;
          round++;
          console.warn(`🔑 rotate NewsAPI key → ${keyIdx}`);
          if (round >= NEWS_KEYS.length) {
            console.warn("⌛ all keys hit rate‑limit – sleeping 60  s");
            await sleep(60_000);
            round = 0;
          }
          continue; // retry same page with new key
        }

        // maximumResultsReached is normal for fresh polling – pause 1 min
        if (status === 426 && code === "maximumResultsReached") {
          await sleep(NEWS_POLL_EVERY_MS);
          break;
        }

        console.warn("NewsAPI error", status, code || err);
        break;
      }
    }

    lastChecked = new Date(now.getTime() - 60_000); // 1‑min overlap
    await sleep(NEWS_POLL_EVERY_MS);
  }
}

/* ─────────── Homepage crawler loop ─────────── */

/**
 * Crawl a homepage for links and ingest them.
 *
 * @param browser - The Puppeteer browser instance.
 */
async function crawlLoop(browser: Browser) {
  while (true) {
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
    await sleep(CRAWL_EVERY_MS);
  }
}

/* ─────────── MAIN ─────────── */

/**
 * Main function to start the crawler.
 * Note: This is designed to run infinitely to
 * continuously fetch and process articles as they become available.
 */
async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Mongo connected");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  await Promise.all([newsLoop(browser), crawlLoop(browser)]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
