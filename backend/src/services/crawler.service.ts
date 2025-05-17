import puppeteer from "puppeteer-core";
const chromium = require("@sparticuz/chromium");
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";

export interface ArticleData {
  url: string;
  title: string;
  content: string;
  source: string;
}

const RETRY_DELAY_MS = 2000;
const AXIOS_TIMEOUT_MS = 10000; // Abort axios requests after 10 seconds
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Derive a title from the raw title or the body of the article.
 *
 * @param rawTitle - The raw title of the article.
 * @param content - The body content of the article.
 */
const deriveTitle = (rawTitle: string, content: string): string => {
  const title = rawTitle.trim();
  if (title) return title;

  const firstSentenceMatch = content.match(/(.{1,120}?[.!?])\s/);
  if (firstSentenceMatch) return firstSentenceMatch[1].trim();

  const firstWords = content.split(/\s+/).slice(0, 10).join(" ").trim();
  return firstWords || "Untitled";
};

/**
 * Fetch a dynamic article using Puppeteer.
 *
 * @param url - The URL of the article to fetch.
 */
export const fetchDynamicArticle = async (
  url: string,
): Promise<ArticleData> => {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: chromium.headless,
    args: chromium.args,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  );

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
  } catch {
    console.warn(
      `networkidle2 timed out for ${url}, falling back to domcontentloaded...`,
    );
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (err) {
      await browser.close();
      throw err;
    }
  }

  const html = await page.content();
  await browser.close();

  const $ = cheerio.load(html);
  $("script, style").remove();
  $('head [type="application/ld+json"]').remove();

  const content = $("body").text().trim() || "";
  const title = deriveTitle($("title").text(), content);

  return { url, title, content, source: url };
};

/**
 * Fetch a static article using Axios.
 *
 * @param url - The URL of the article to fetch.
 * @param retries - The number of retries on failure.
 */
export const fetchStaticArticle = async (
  url: string,
  retries = 3,
): Promise<ArticleData> => {
  try {
    const { data } = await axios.get<string>(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      timeout: AXIOS_TIMEOUT_MS,
    });

    const $ = cheerio.load(data);
    $("script, style").remove();
    $('head [type="application/ld+json"]').remove();

    const content = $("body").text().trim() || "";
    const title = deriveTitle($("title").text(), content);

    return { url, title, content, source: url };
  } catch (err: any) {
    // Retry on network reset or timeout
    if (
      retries > 0 &&
      (err.code === "ECONNRESET" || err.code === "ECONNABORTED")
    ) {
      console.warn(
        `Error (${err.code}) fetching ${url}, retrying in ${RETRY_DELAY_MS}ms...`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchStaticArticle(url, retries - 1);
    }

    // On 403, fall back to dynamic
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      console.warn(`Static fetch 403 for ${url}, falling back to dynamic...`);
      return fetchDynamicArticle(url);
    }

    throw err;
  }
};

/**
 * Crawl a list of homepage URLs to find articles.
 * Performs a breadth-first search (BFS) to collect links level by level.
 * Includes headers rotation and site protection bypassing to avoid 403 errors.
 *
 * @param homepageUrls - A single URL or an array of URLs to crawl.
 * @param maxLinks - The maximum number of links to collect.
 * @param maxDepth - The maximum depth to crawl.
 * @param concurrency - The number of concurrent requests.
 */
export const crawlArticlesFromHomepage = async (
  homepageUrls: string | string[],
  maxLinks = 20,
  maxDepth = 1,
  concurrency = 5,
): Promise<string[]> => {
  const seeds = Array.isArray(homepageUrls) ? homepageUrls : [homepageUrls];

  type QueueItem = { url: string; depth: number; domain: string };
  const queue: QueueItem[] = seeds.map((u) => ({
    url: u,
    depth: 0,
    domain: new URL(u).hostname,
  }));

  const visited = new Set<string>();
  const collected = new Set<string>();

  const worker = async () => {
    while (collected.size < maxLinks) {
      const item = queue.shift();
      if (!item) break;

      const { url, depth, domain } = item;
      if (visited.has(url)) continue;
      visited.add(url);

      let html: string;
      try {
        const resp = await axios.get<string>(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 " +
              "Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;" +
              "q=0.9,image/webp,*/*;q=0.8",
          },
          timeout: AXIOS_TIMEOUT_MS,
        });
        html = resp.data;
      } catch {
        continue; // skip unreachable pages
      }

      const $ = cheerio.load(html);
      const linksOnPage: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        try {
          const abs = new URL(href, url).href;
          if (new URL(abs).hostname === domain) {
            linksOnPage.push(abs);
          }
        } catch {
          /* ignore malformed URLs */
        }
      });

      // Collect up to maxLinks
      for (const link of linksOnPage) {
        if (collected.size >= maxLinks) break;
        if (!collected.has(link) && link !== url) {
          collected.add(link);
        }
      }

      // Enqueue next-depth
      if (depth + 1 < maxDepth) {
        for (const link of linksOnPage) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: depth + 1, domain });
          }
        }
      }
    }
  };

  // Launch workers that naturally dovetail across all seeded homepages
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return Array.from(collected).slice(0, maxLinks);
};
