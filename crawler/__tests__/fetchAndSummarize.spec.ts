import mongoose from "mongoose";
import { fetchAndSummarize } from "../schedule/fetchAndSummarize";
import Article from "../models/article.model";
import {
  crawlArticlesFromHomepage,
  fetchStaticArticle,
} from "../services/crawler.service";
import { fetchArticlesFromNewsAPI } from "../services/apiFetcher.service";
import { summarizeContent } from "../services/summarization.service";
import { extractTopics } from "../services/topicExtractor.service";
import logger from "../utils/logger";

// --- Mock everything external ---
jest.mock("mongoose", () => ({
  connect: jest.fn(),
  set: jest.fn(),
  connection: { collections: {} },
}));
jest.mock("../services/crawler.service");
jest.mock("../services/apiFetcher.service");
jest.mock("../services/summarization.service");
jest.mock("../services/topicExtractor.service");
jest.mock("../utils/logger");

beforeEach(() => {
  jest.resetAllMocks();

  // Required env vars
  process.env.MONGODB_URI = "mongodb://test-uri";
  process.env.CRAWL_URLS = "https://a.com,https://b.com";
  process.env.CRAWL_MAX_LINKS = "2";
  process.env.CRAWL_MAX_DEPTH = "1";
  process.env.CRAWL_CONCURRENCY = "2";
  process.env.FETCH_CONCURRENCY = "2";
  process.env.DELAY_BETWEEN_REQUESTS_MS = "0";
  process.env.MAX_FETCH_TIME_MS = "100";

  // Crawler returns same two URLs per seed
  (crawlArticlesFromHomepage as jest.Mock).mockResolvedValue(["u1", "u2"]);
  // NewsAPI returns one overlap and one new
  (fetchArticlesFromNewsAPI as jest.Mock).mockResolvedValue([
    { url: "u2" },
    { url: "u3" },
  ]);

  // Static fetch always returns non‐empty content
  (fetchStaticArticle as jest.Mock).mockImplementation(async (url: string) =>
    Promise.resolve({ url, title: "T", content: "C", source: url }),
  );

  (summarizeContent as jest.Mock).mockResolvedValue("summary");
  (extractTopics as jest.Mock).mockResolvedValue(["topic"]);

  // Article.find: pretend "u1" already exists
  jest.spyOn(Article, "find").mockResolvedValue([{ url: "u1" }] as any[]);

  // Track saves
  jest.spyOn(Article.prototype, "save").mockImplementation(async function () {
    return this;
  });
});

afterEach(() => {
  delete process.env.MONGODB_URI;
  delete process.env.CRAWL_URLS;
});

describe("fetchAndSummarize", () => {
  it("saves only new URLs (u2 and u3)", async () => {
    const savedUrls: string[] = [];
    (Article.prototype.save as jest.Mock).mockImplementation(async function () {
      savedUrls.push(this.url);
      return this;
    });

    await fetchAndSummarize();

    expect(savedUrls.sort()).toEqual(["u2", "u3"]);
  });

  it("logs but continues when NewsAPI fails", async () => {
    // NewsAPI throws
    (fetchArticlesFromNewsAPI as jest.Mock).mockRejectedValue(
      new Error("API down"),
    );

    await expect(fetchAndSummarize()).resolves.not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to fetch from NewsAPI:",
      expect.any(Error),
    );
  });

  it("skips articles with empty content", async () => {
    // First two static fetch calls: one empty, one non-empty
    let call = 0;
    (fetchStaticArticle as jest.Mock).mockImplementation(
      async (url: string) => {
        call++;
        return {
          url,
          title: "T",
          content: call === 1 ? "   " : "Good content",
          source: url,
        };
      },
    );

    const savedUrls: string[] = [];
    (Article.prototype.save as jest.Mock).mockImplementation(async function () {
      savedUrls.push(this.url);
      return this;
    });

    await fetchAndSummarize();

    // Only second URL from each batch should be saved (u2 and u3)
    expect(savedUrls).toEqual(["u2", "u3"]);
  });

  it("warns and skips on duplicate key error", async () => {
    // Save throws duplicate-key error on u2, succeeds on u3
    (Article.prototype.save as jest.Mock)
      .mockImplementationOnce(async () => {
        const err: any = new Error("dup");
        err.code = 11000;
        throw err;
      })
      .mockImplementationOnce(async function () {
        return this;
      });

    const warned: string[] = [];
    (logger.warn as jest.Mock).mockImplementation((msg: string) => {
      warned.push(msg);
    });

    await fetchAndSummarize();
    expect(warned).toContain("Duplicate URL u2, skipping.");
  });
});
