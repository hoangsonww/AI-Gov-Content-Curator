// src/__tests__/analytics.controller.spec.js

// Mock the models
jest.mock("../models/article.model", () => ({
  aggregate: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../models/rating.model", () => ({
  aggregate: jest.fn(),
}));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue("AI generated summary"),
        },
      }),
    }),
  })),
}));

const Article = require("../models/article.model");
const Rating = require("../models/rating.model");
const {
  getSourceDistribution,
  getTopicTrends,
  getBiasTrends,
  getTopRatedArticles,
  getAnalyticsInsights,
} = require("../controllers/analytics.controller");

describe("Analytics Controller", () => {
  let req, res, jsonMock, statusMock;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { json: jsonMock, status: statusMock };
  });

  describe("getSourceDistribution()", () => {
    it("200 returns source distribution without date filters", async () => {
      const mockDistribution = [
        { _id: "BBC", count: 10 },
        { _id: "White House", count: 8 },
        { _id: "CNN", count: 5 },
      ];

      Article.aggregate.mockResolvedValue(mockDistribution);
      req = { query: {} };

      await getSourceDistribution(req, res);

      expect(Article.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          { source: "BBC", count: 10, percentage: "43.48" },
          { source: "White House", count: 8, percentage: "34.78" },
          { source: "CNN", count: 5, percentage: "21.74" },
        ],
        total: 23,
      });
    });

    it("200 applies date filters when provided", async () => {
      const mockDistribution = [{ _id: "BBC", count: 5 }];
      Article.aggregate.mockResolvedValue(mockDistribution);

      req = {
        query: { startDate: "2024-01-01", endDate: "2024-01-31" },
      };

      await getSourceDistribution(req, res);

      const aggregateCalls = Article.aggregate.mock.calls[0][0];
      expect(aggregateCalls[0].$match.fetchedAt).toBeDefined();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ source: "BBC", count: 5, percentage: "100.00" }],
        total: 5,
      });
    });

    it("500 handles errors gracefully", async () => {
      Article.aggregate.mockRejectedValue(new Error("DB error"));
      req = { query: {} };

      await getSourceDistribution(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch source distribution",
        message: "DB error",
      });
    });
  });

  describe("getTopicTrends()", () => {
    it("200 returns topic trends by day", async () => {
      const mockTrends = [
        { _id: { period: "2024-01-01", topic: "climate" }, count: 5 },
        { _id: { period: "2024-01-02", topic: "climate" }, count: 7 },
        { _id: { period: "2024-01-01", topic: "politics" }, count: 3 },
      ];

      Article.aggregate.mockResolvedValue(mockTrends);
      req = { query: { interval: "day" } };

      await getTopicTrends(req, res);

      expect(Article.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2); // Two unique topics
      expect(response.interval).toBe("day");
    });

    it("500 handles errors gracefully", async () => {
      Article.aggregate.mockRejectedValue(new Error("DB error"));
      req = { query: {} };

      await getTopicTrends(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch topic trends",
        message: "DB error",
      });
    });
  });

  describe("getBiasTrends()", () => {
    it("200 returns bias trends placeholder", async () => {
      const mockBias = [
        { _id: "BBC", count: 10 },
        { _id: "CNN", count: 5 },
      ];

      Article.aggregate.mockResolvedValue(mockBias);
      req = { query: {} };

      await getBiasTrends(req, res);

      expect(Article.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            source: "BBC",
            articles: 10,
            biasScore: 0,
            biasLabel: "Neutral",
          },
          {
            source: "CNN",
            articles: 5,
            biasScore: 0,
            biasLabel: "Neutral",
          },
        ],
        message: expect.stringContaining("Bias analysis is available"),
      });
    });

    it("500 handles errors gracefully", async () => {
      Article.aggregate.mockRejectedValue(new Error("DB error"));
      req = { query: {} };

      await getBiasTrends(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch bias trends",
        message: "DB error",
      });
    });
  });

  describe("getTopRatedArticles()", () => {
    it("200 returns top-rated articles", async () => {
      const mockRatings = [
        { _id: "article1", averageRating: 85, totalRatings: 5 },
        { _id: "article2", averageRating: 80, totalRatings: 3 },
      ];

      const mockArticles = [
        {
          _id: "article1",
          title: "Great Article",
          source: "BBC",
          topics: ["climate"],
          fetchedAt: new Date(),
          url: "http://example.com/1",
        },
        {
          _id: "article2",
          title: "Good Article",
          source: "CNN",
          topics: ["politics"],
          fetchedAt: new Date(),
          url: "http://example.com/2",
        },
      ];

      Rating.aggregate.mockResolvedValue(mockRatings);
      Article.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockArticles),
      });

      req = { query: { limit: 10 } };

      await getTopRatedArticles(req, res);

      expect(Rating.aggregate).toHaveBeenCalled();
      expect(Article.find).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.data[0].averageRating).toBe(85);
    });

    it("500 handles errors gracefully", async () => {
      Rating.aggregate.mockRejectedValue(new Error("DB error"));
      req = { query: {} };

      await getTopRatedArticles(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch top-rated articles",
        message: "DB error",
      });
    });
  });

  describe("getAnalyticsInsights()", () => {
    it("200 returns insights with statistics", async () => {
      const mockAggregation = [
        {
          _id: null,
          totalArticles: 10,
          sources: ["BBC", "CNN"],
          allTopics: [["climate", "politics"], ["climate"]],
        },
      ];

      Article.aggregate.mockResolvedValue(mockAggregation);
      req = { query: { days: 7 } };

      // Mock environment variable
      const originalEnv = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "test-key";

      await getAnalyticsInsights(req, res);

      expect(Article.aggregate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.stats.totalArticles).toBe(10);
      expect(response.data.stats.sources).toHaveLength(2);

      // Restore environment
      process.env.GEMINI_API_KEY = originalEnv;
    });

    it("200 handles no articles scenario", async () => {
      Article.aggregate.mockResolvedValue([]);
      req = { query: { days: 7 } };

      await getAnalyticsInsights(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          summary: expect.stringContaining("No recent articles found"),
          totalArticles: 0,
          period: "Last 7 days",
        },
      });
    });

    it("500 handles errors gracefully", async () => {
      Article.aggregate.mockRejectedValue(new Error("DB error"));
      req = { query: {} };

      await getAnalyticsInsights(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to generate insights",
        message: "DB error",
      });
    });
  });
});
