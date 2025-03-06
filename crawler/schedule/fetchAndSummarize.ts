import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Article from "../models/article.model";
import {
  crawlArticlesFromHomepage,
  fetchStaticArticle,
} from "../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../services/apiFetcher.service";
import { summarizeContent } from "../services/summarization.service";
import logger from "../utils/logger";

dotenv.config();
mongoose.set("strictQuery", false);

const MONGODB_URI = process.env.MONGODB_URI || "";
const DELAY_BETWEEN_REQUESTS_MS = 1000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchAndSummarize = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {});
    logger.info("Connected to MongoDB");

    // Use the environment variable that you actually have (CRAWL_URLS or HOMEPAGE_URLS)
    const homepageUrls = process.env.CRAWL_URLS
      ? process.env.CRAWL_URLS.split(",")
          .map((url) => url.trim())
          .filter((url) => url)
      : [];

    let articleUrls: string[] = [];

    // Crawl each homepage for article links.
    // The BFS now collects more levels (default: 2).
    // Increase or decrease as you see fit in crawler.service.
    for (const homepageUrl of homepageUrls) {
      logger.info(`Crawling: ${homepageUrl}`);
      // This function now does BFS, so it can gather sub-page links
      const links = await crawlArticlesFromHomepage(homepageUrl, 40, 2);
      // e.g., up to 40 links total, 2 levels deep
      logger.info(`Crawled ${links.length} article links from ${homepageUrl}`);
      articleUrls = articleUrls.concat(links);
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }

    // Deduplicate
    articleUrls = Array.from(new Set(articleUrls));

    // Also add articles from the public API
    const apiArticles = await fetchArticlesFromNewsAPI();
    const apiArticleUrls = apiArticles.map((a) => a.url);
    articleUrls = Array.from(new Set([...articleUrls, ...apiArticleUrls]));

    logger.info(`Total unique article URLs to process: ${articleUrls.length}`);

    // Process each article
    for (const url of articleUrls) {
      try {
        logger.info(`Fetching article from ${url}`);
        const articleData = await fetchStaticArticle(url);

        if (!articleData.content || articleData.content.trim() === "") {
          logger.warn(`Skipping article at ${url} due to empty content`);
          continue;
        }

        let summary: string;
        try {
          summary = await summarizeContent(articleData.content);
        } catch (sumError) {
          logger.error(`Summarization failed for article at ${url}:`, sumError);
          continue;
        }

        const article = new Article({
          url: articleData.url,
          title: articleData.title,
          content: articleData.content,
          summary: summary,
          source: articleData.source,
          fetchedAt: new Date(),
        });

        await article.save();
        logger.info(`Saved article: ${article.title}`);
        await delay(DELAY_BETWEEN_REQUESTS_MS);
      } catch (err: any) {
        if (err.code === 11000) {
          logger.warn(`Duplicate article at ${url}. Skipping.`);
        } else {
          logger.error(`Error processing article at ${url}:`, err);
        }
      }
    }

    logger.info("Fetch and summarization complete.");
    return { status: "success" };
  } catch (err) {
    logger.error("Error in scheduled task:", err);
    throw err;
  }
};

// ******* CALL IT HERE *******
if (require.main === module) {
  // If this file is executed directly via "ts-node",
  // call fetchAndSummarize() so it actually does work.
  fetchAndSummarize()
    .then((res) => {
      console.log("Done crawling and summarizing:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
