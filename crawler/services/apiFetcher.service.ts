// services/newsapi.service.ts

import axios, { AxiosResponse } from "axios";
import { ArticleData } from "./crawler.service";

const PAGE_SIZE = 100; // Max articles per NewsAPI page
const MAX_CONCURRENCY = 5; // Number of parallel page‐fetches

/**
 * Fetch all pages from NewsAPI in parallel (with limited concurrency)
 * and return a flattened list of ArticleData.
 */
export const fetchArticlesFromNewsAPI = async (): Promise<ArticleData[]> => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY");
  }

  // Trusted domains for NewsAPI
  const trustedDomains =
    "nytimes.com,washingtonpost.com,dallasnews.com,statesman.com,houstonchronicle.com,expressnews.com";
  const query = encodeURIComponent("politics OR government OR election");
  const baseUrl =
    `https://newsapi.org/v2/everything` +
    `?language=en&q=${query}&sortBy=publishedAt` +
    `&domains=${trustedDomains}&apiKey=${apiKey}` +
    `&pageSize=${PAGE_SIZE}`;

  // Fetch the first page to determine totalResults
  const firstResp: AxiosResponse<any> = await axios.get(`${baseUrl}&page=1`);
  const totalResults: number = firstResp.data.totalResults || 0;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);

  // Helper: fetch a single page
  const fetchPage = async (page: number): Promise<ArticleData[]> => {
    const resp = await axios.get(`${baseUrl}&page=${page}`);
    return resp.data.articles.map((a: any) => ({
      url: a.url,
      title: a.title,
      content: a.content || a.description || "",
      source: a.source.name || "NewsAPI",
    }));
  };

  // Create array of page numbers [1..totalPages]
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Concurrency-limited runner
  const results: ArticleData[][] = [];
  for (let i = 0; i < pages.length; i += MAX_CONCURRENCY) {
    const chunk = pages.slice(i, i + MAX_CONCURRENCY);
    // fetch this chunk in parallel
    const chunkResults = await Promise.all(chunk.map(fetchPage));
    results.push(...chunkResults);
  }

  // Flatten and return
  return results.flat();
};
