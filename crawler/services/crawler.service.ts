import puppeteer from "puppeteer-core";
import chromium = require("@sparticuz/chromium");
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
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Use Puppeteer to fetch an article dynamically.
 * This version uses puppeteer-core with @sparticuz/chromium,
 * which is optimized for environments like Vercel.
 */
export const fetchDynamicArticle = async (
  url: string
): Promise<ArticleData> => {
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    executablePath,               // Use the lightweight Chromium binary path
    headless: chromium.headless,  // Use recommended headless settings
    args: chromium.args,          // Use necessary arguments for a Lambda/Vercel environment
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
  );
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();

  // Remove unnecessary elements to reduce noise
  const $ = cheerio.load(html);
  $("script").remove();
  $("style").remove();
  $('head [type="application/ld+json"]').remove();

  const title = $("title").text().trim() || "Untitled";
  const content = $("body").text().trim() || "";

  await browser.close();
  return { url, title, content, source: url };
};

/**
 * Attempt a static fetch with Axios and Cheerio.
 * If it fails (e.g., 403) or returns incomplete data, fall back to the dynamic fetch.
 */
export const fetchStaticArticle = async (
  url: string,
  retries = 3
): Promise<ArticleData> => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const $ = cheerio.load(data);
    $("script").remove();
    $("style").remove();
    $('head [type="application/ld+json"]').remove();

    const title = $("title").text().trim() || "Untitled";
    const content = $("body").text().trim() || "";
    return { url, title, content, source: url };
  } catch (error: any) {
    if (retries > 0 && error.code === "ECONNRESET") {
      console.warn(
        `ECONNRESET for ${url}. Retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`
      );
      await delay(RETRY_DELAY_MS);
      return fetchStaticArticle(url, retries - 1);
    }

    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 403
    ) {
      console.warn(
        `Static fetch for ${url} returned 403. Falling back to dynamic fetch...`
      );
      return await fetchDynamicArticle(url);
    }

    throw error;
  }
};

/**
 * Multi-level BFS crawl to collect article links.
 */
export const crawlArticlesFromHomepage = async (
  homepageUrl: string,
  maxLinks: number = 20,
  maxDepth: number = 1
): Promise<string[]> => {
  const queue: Array<{ url: string; depth: number }> = [
    { url: homepageUrl, depth: 0 },
  ];
  const visited = new Set<string>();
  const collectedLinks = new Set<string>();

  const homepageHostname = new URL(homepageUrl).hostname;

  while (queue.length > 0 && collectedLinks.size < maxLinks) {
    const { url, depth } = queue.shift()!;

    if (visited.has(url)) continue;
    visited.add(url);

    let html: string;
    try {
      const { data } = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
      });
      html = data;
    } catch (err) {
      continue;
    }

    const $ = cheerio.load(html);
    const foundThisPage: string[] = [];
    $("a").each((_, el) => {
      let link = $(el).attr("href");
      if (!link) return;
      try {
        link = new URL(link, url).href;
        const hostname = new URL(link).hostname;
        if (hostname === homepageHostname && link !== homepageUrl) {
          foundThisPage.push(link);
        }
      } catch {
        // Skip invalid URLs
      }
    });

    for (const lnk of foundThisPage) {
      if (collectedLinks.size >= maxLinks) break;
      collectedLinks.add(lnk);
    }

    if (depth + 1 < maxDepth) {
      for (const lnk of foundThisPage) {
        if (!visited.has(lnk) && collectedLinks.size < maxLinks) {
          queue.push({ url: lnk, depth: depth + 1 });
        }
      }
    }
  }

  return Array.from(collectedLinks);
};
