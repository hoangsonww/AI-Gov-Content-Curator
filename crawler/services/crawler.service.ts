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
 * Use Puppeteer to fetch an article dynamically.
 * This version first attempts to wait for "networkidle2".
 * If that times out, it falls back to "domcontentloaded".
 */
export const fetchDynamicArticle = async (
  url: string,
): Promise<ArticleData> => {
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    executablePath, // Use the lightweight Chromium binary path
    headless: chromium.headless, // Use recommended headless settings
    args: chromium.args, // Necessary arguments for your environment
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  );

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
  } catch (error) {
    console.warn(
      `Navigation using "networkidle2" timed out for ${url}. Falling back to "domcontentloaded"...`,
    );
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (fallbackError) {
      console.error(
        `Navigation failed for ${url} even with "domcontentloaded":`,
        fallbackError,
      );
      await browser.close();
      throw fallbackError;
    }
  }

  const html = await page.content();
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
 * If it fails (e.g., ECONNRESET, timeout, or 403), fall back to the dynamic fetch.
 * Now uses a timeout so that requests don't stall for too long.
 */
export const fetchStaticArticle = async (
  url: string,
  retries = 3,
): Promise<ArticleData> => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      timeout: AXIOS_TIMEOUT_MS, // Set timeout for axios request
    });
    const $ = cheerio.load(data);
    $("script").remove();
    $("style").remove();
    $('head [type="application/ld+json"]').remove();

    const title = $("title").text().trim() || "Untitled";
    const content = $("body").text().trim() || "";
    return { url, title, content, source: url };
  } catch (error: any) {
    // For ECONNRESET or timeout errors, retry a limited number of times
    if (
      retries > 0 &&
      (error.code === "ECONNRESET" || error.code === "ECONNABORTED")
    ) {
      console.warn(
        `Error (${error.code}) for ${url}. Retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchStaticArticle(url, retries - 1);
    }

    // If error is a 403, fall back to dynamic fetching immediately
    if (
      axios.isAxiosError(error) &&
      error.response &&
      error.response.status === 403
    ) {
      console.warn(
        `Static fetch for ${url} returned 403. Falling back to dynamic fetch...`,
      );
      return await fetchDynamicArticle(url);
    }

    // If we've exhausted retries or encountered another error, throw to be caught in the main loop.
    throw error;
  }
};

/**
 * Multi-level BFS crawl to collect article links.
 */
export const crawlArticlesFromHomepage = async (
  homepageUrl: string,
  maxLinks: number = 20,
  maxDepth: number = 1,
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
        timeout: AXIOS_TIMEOUT_MS,
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
