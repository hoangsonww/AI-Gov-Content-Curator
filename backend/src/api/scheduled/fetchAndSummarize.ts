import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Article from "../../models/article.model";
import {
  crawlArticlesFromHomepage,
  fetchStaticArticle,
} from "../../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../../services/apiFetcher.service";
import { summarizeContent } from "../../services/summarization.service";

dotenv.config();
mongoose.set("strictQuery", false);

const MONGODB_URI = process.env.MONGODB_URI || "";
const DELAY_BETWEEN_REQUESTS_MS = 1000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    await mongoose.connect(MONGODB_URI, {});
    console.log("Connected to MongoDB");

    // Get homepage URLs from environment variable (comma-separated)
    const homepageUrls = process.env.HOMEPAGE_URLS
      ? process.env.HOMEPAGE_URLS.split(",")
          .map((url) => url.trim())
          .filter((url) => url)
      : [];

    let articleUrls: string[] = [];

    // Crawl each homepage for article links.
    for (const homepageUrl of homepageUrls) {
      const links = await crawlArticlesFromHomepage(homepageUrl, 20);
      console.log(`Crawled ${links.length} article links from ${homepageUrl}`);
      articleUrls = articleUrls.concat(links);
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }

    // Deduplicate article URLs.
    articleUrls = Array.from(new Set(articleUrls));

    // Also add articles from the public API.
    const apiArticles = await fetchArticlesFromNewsAPI();
    const apiArticleUrls = apiArticles.map((a) => a.url);
    articleUrls = Array.from(new Set([...articleUrls, ...apiArticleUrls]));

    console.log(`Total unique article URLs to process: ${articleUrls.length}`);

    // Process each article sequentially.
    for (const url of articleUrls) {
      try {
        console.log(`Fetching article from ${url}`);
        const articleData = await fetchStaticArticle(url);
        // Skip if content is empty.
        if (!articleData.content || articleData.content.trim() === "") {
          console.warn(`Skipping article at ${url} due to empty content`);
          continue;
        }
        let summary: string;
        try {
          summary = await summarizeContent(articleData.content);
        } catch (sumError) {
          console.error(
            `Summarization failed for article at ${url}:`,
            sumError,
          );
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
        console.log(`Saved article: ${article.title}`);
        await delay(DELAY_BETWEEN_REQUESTS_MS);
      } catch (err: any) {
        // Skip duplicate entries.
        if (err.code === 11000) {
          console.warn(`Duplicate article at ${url}. Skipping.`);
        } else {
          console.error(`Error processing article at ${url}:`, err);
        }
      }
    }

    console.log("Fetch and summarization complete.");
    // Close the mongoose connection to avoid hanging function.
    await mongoose.connection.close();
    res.status(200).json({ message: "Fetch and summarization complete." });
  } catch (err) {
    console.error("Error in scheduled task:", err);
    res.status(500).json({ error: err });
  }
};
