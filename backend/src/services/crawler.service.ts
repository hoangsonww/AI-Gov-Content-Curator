import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
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
 * Use Puppeteer to fetch an article if static fetch is blocked or returns incomplete content.
 */
export const fetchDynamicArticle = async (
  url: string,
): Promise<ArticleData> => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  );
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();

  // Remove script/style/JSON-LD to reduce noise
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
 * Attempt a static (Axios + Cheerio) fetch. If blocked or partial (403, etc.), fall back to Puppeteer.
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
    });

    // Remove script/style/JSON-LD to reduce noise
    const $ = cheerio.load(data);
    $("script").remove();
    $("style").remove();
    $('head [type="application/ld+json"]').remove();

    const title = $("title").text().trim() || "Untitled";
    const content = $("body").text().trim() || "";
    return { url, title, content, source: url };
  } catch (error: any) {
    // Retry on ECONNRESET errors
    if (retries > 0 && error.code === "ECONNRESET") {
      console.warn(
        `ECONNRESET for ${url}. Retrying in ${RETRY_DELAY_MS}ms... (${retries} retries left)`,
      );
      await delay(RETRY_DELAY_MS);
      return fetchStaticArticle(url, retries - 1);
    }

    // If 403, fall back to Puppeteer (dynamic fetch)
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

    throw error;
  }
};

/**
 * Multi-level BFS crawl:
 *  - maxLinks: total # of links to collect across all pages (including sub-levels).
 *  - maxDepth: how many levels deep to crawl.
 *    e.g. 2 means: homepage -> sub-links (but not sub-sub-links).
 */
export const crawlArticlesFromHomepage = async (
  homepageUrl: string,
  maxLinks: number = 20,
  maxDepth: number = 1,
): Promise<string[]> => {
  // BFS queue: each entry has url + current depth
  const queue: Array<{ url: string; depth: number }> = [
    { url: homepageUrl, depth: 0 },
  ];
  const visited = new Set<string>(); // to avoid re-crawling same URL
  const collectedLinks = new Set<string>(); // final list of found article links

  const homepageHostname = new URL(homepageUrl).hostname;

  while (queue.length > 0 && collectedLinks.size < maxLinks) {
    const { url, depth } = queue.shift()!;

    // If visited, skip
    if (visited.has(url)) continue;
    visited.add(url);

    // Fetch page
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
      // console.error(`Failed to fetch ${url}:`, err);
      continue;
    }

    // Parse page
    const $ = cheerio.load(html);

    // Collect <a> links on this page
    const foundThisPage: string[] = [];
    $("a").each((_, el) => {
      let link = $(el).attr("href");
      if (!link) return;
      try {
        link = new URL(link, url).href; // absolute URL
        const hostname = new URL(link).hostname;
        if (hostname === homepageHostname && link !== homepageUrl) {
          foundThisPage.push(link);
        }
      } catch {
        // invalid URL, skip
      }
    });

    // Add to the final set, respecting maxLinks
    for (const lnk of foundThisPage) {
      if (collectedLinks.size >= maxLinks) break;
      collectedLinks.add(lnk);
    }

    // If we can go deeper, enqueue those same-page links to parse
    // so long as we haven't exceeded maxDepth
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
