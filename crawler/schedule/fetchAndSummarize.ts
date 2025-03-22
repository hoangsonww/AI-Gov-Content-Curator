import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Article from "../models/article.model";
import {
  crawlArticlesFromHomepage,
  fetchStaticArticle,
} from "../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../services/apiFetcher.service";
import { summarizeContent } from "../services/summarization.service";
import { extractTopics } from "../services/topicExtractor.service";
import logger from "../utils/logger";

dotenv.config();
mongoose.set("strictQuery", false);

const MONGODB_URI = process.env.MONGODB_URI || "";
const DELAY_BETWEEN_REQUESTS_MS = 1000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * CRON job to fetch articles from specified homepages, summarize them, and store them in MongoDB.
 * Runs every day at 6:00 AM.
 */
export const fetchAndSummarize = async () => {
  try {
    // 1) Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {});
    logger.info("Connected to MongoDB");

    // 2) Gather homepage URLs from environment
    const homepageUrls = process.env.CRAWL_URLS
      ? process.env.CRAWL_URLS.split(",")
          .map((url) => url.trim())
          .filter((url) => url)
      : [];

    let articleUrls: string[] = [];

    // 3) Crawl each homepage
    for (const homepageUrl of homepageUrls) {
      logger.info(`Crawling: ${homepageUrl}`);
      const links = await crawlArticlesFromHomepage(homepageUrl, 40, 2);
      logger.info(`Crawled ${links.length} article links from ${homepageUrl}`);
      articleUrls = articleUrls.concat(links);
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }

    // 4) Add articles from News API
    const apiArticles = await fetchArticlesFromNewsAPI();
    const apiArticleUrls = apiArticles.map((a) => a.url);
    articleUrls = articleUrls.concat(apiArticleUrls);

    // 5) Deduplicate URLs
    articleUrls = Array.from(new Set(articleUrls));

    // 6) Filter out articles that already exist in the database
    const existingDocs = await Article.find(
      { url: { $in: articleUrls } },
      { url: 1 }, // only return the url field
    );
    const existingUrls = new Set(existingDocs.map((doc) => doc.url));
    const newUrls = articleUrls.filter((u) => !existingUrls.has(u));

    logger.info(
      `Total unique article URLs: ${articleUrls.length}. New: ${newUrls.length}`,
    );

    // 7) Process only new URLs
    for (const url of newUrls) {
      try {
        logger.info(`Fetching article from ${url}`);
        const articleData = await fetchStaticArticle(url);

        if (!articleData.content || articleData.content.trim() === "") {
          logger.warn(`Skipping article at ${url} due to empty content`);
          continue;
        }

        // Summarize the article content
        let summary: string;
        try {
          summary = await summarizeContent(articleData.content);
        } catch (sumError) {
          logger.error(`Summarization failed for article at ${url}:`, sumError);
          continue;
        }

        // Extract topics from the article content
        let topics: string[] = [];
        try {
          topics = await extractTopics(summary);
        } catch (topicError) {
          logger.error(
            `Topic extraction failed for article at ${url}:`,
            topicError,
          );
          // Optionally, we can skip articles that fail topic extraction:
          // continue;
          // For now, we will just log the error and proceed with an empty topics array
          // to still save the article without topics.
        }

        // Create and save the article with topics included
        const article = new Article({
          url: articleData.url,
          title: articleData.title,
          content: articleData.content,
          summary,
          topics,
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
