import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Article from '../models/article.model';
import { crawlArticlesFromHomepage, fetchStaticArticle } from '../services/crawler.service';
import { fetchArticlesFromNewsAPI } from '../services/apiFetcher.service';
import { summarizeContent } from '../services/summarization.service';
import logger from '../utils/logger';

dotenv.config();
mongoose.set('strictQuery', false);

const MONGODB_URI = process.env.MONGODB_URI || '';
const DELAY_BETWEEN_REQUESTS_MS = 1000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchAndSummarize = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {});
        logger.info('Connected to MongoDB');

        // Get homepage URLs from environment variable (comma-separated)
        const homepageUrls = process.env.HOMEPAGE_URLS
            ? process.env.HOMEPAGE_URLS.split(',').map(url => url.trim()).filter(url => url)
            : [];

        let articleUrls: string[] = [];

        // Crawl each homepage for article links.
        for (const homepageUrl of homepageUrls) {
            const links = await crawlArticlesFromHomepage(homepageUrl, 20);
            logger.info(`Crawled ${links.length} article links from ${homepageUrl}`);
            articleUrls = articleUrls.concat(links);
            await delay(DELAY_BETWEEN_REQUESTS_MS);
        }

        // Deduplicate article URLs.
        articleUrls = Array.from(new Set(articleUrls));

        // Also add articles from the public API.
        const apiArticles = await fetchArticlesFromNewsAPI();
        const apiArticleUrls = apiArticles.map(a => a.url);
        articleUrls = Array.from(new Set([...articleUrls, ...apiArticleUrls]));

        logger.info(`Total unique article URLs to process: ${articleUrls.length}`);

        // Process each article sequentially.
        for (const url of articleUrls) {
            try {
                logger.info(`Fetching article from ${url}`);
                const articleData = await fetchStaticArticle(url);
                // Skip if content is empty.
                if (!articleData.content || articleData.content.trim() === '') {
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
                    fetchedAt: new Date()
                });
                await article.save();
                logger.info(`Saved article: ${article.title}`);
                await delay(DELAY_BETWEEN_REQUESTS_MS);
            } catch (err: any) {
                // Skip duplicate entries.
                if (err.code === 11000) {
                    logger.warn(`Duplicate article at ${url}. Skipping.`);
                } else {
                    logger.error(`Error processing article at ${url}:`, err);
                }
            }
        }

        logger.info('Fetch and summarization complete.');
        // Instead of process.exit, simply return a success message.
        return { status: "success" };
    } catch (err) {
        logger.error('Error in scheduled task:', err);
        throw err;
    }
};

export default fetchAndSummarize;
