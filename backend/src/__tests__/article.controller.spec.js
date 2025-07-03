// src/__tests__/article.controller.spec.js

// 1) Mock the Article model’s static methods
jest.mock("../models/article.model", () => ({
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  aggregate: jest.fn(),
}));
const Article = require("../models/article.model");

// 2) Import the controller under test
const {
  getArticles,
  getArticleById,
  getArticleCount,
  searchArticles,
  getAllTopics,
  getArticlesByTopic,
} = require("../controllers/article.controller");

describe("Article Controller", () => {
  let req, res, jsonMock, statusMock;

  const mockArticles = [
    {
      _id: "1",
      url: "http://example.com",
      title: "Test Article",
      summary: "A test summary",
      topics: ["a", "b"],
      source: "TestSource",
      fetchedAt: new Date(),
    },
  ];
  const mockCount = 42;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { json: jsonMock, status: statusMock };
  });

  describe("getArticles()", () => {
    it("200 returns data + count with default pagination", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort:   jest.fn().mockReturnThis(),
        skip:   jest.fn().mockReturnThis(),
        limit:  jest.fn().mockResolvedValue(mockArticles),
      };
      Article.find.mockReturnValue(chain);
      Article.countDocuments.mockResolvedValue(mockCount);

      req = { query: {} };
      await getArticles(req, res);

      expect(Article.find).toHaveBeenCalledWith({});
      expect(chain.select).toHaveBeenCalledWith("-content");
      expect(chain.sort).toHaveBeenCalledWith({ fetchedAt: -1 });
      expect(chain.skip).toHaveBeenCalledWith(0);
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(Article.countDocuments).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({ data: mockArticles, total: mockCount });
    });

    it("200 applies source/topic filters & custom pagination", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort:   jest.fn().mockReturnThis(),
        skip:   jest.fn().mockReturnThis(),
        limit:  jest.fn().mockResolvedValue(mockArticles),
      };
      Article.find.mockReturnValue(chain);
      Article.countDocuments.mockResolvedValue(mockCount);

      req = {
        query: {
          source: "News",
          topic:  "tech,health",
          page:   "3",
          limit:  "5",
        },
      };
      await getArticles(req, res);

      expect(Article.find).toHaveBeenCalledWith({
        source: "News",
        topics: { $in: ["tech", "health"] },
      });
      expect(chain.skip).toHaveBeenCalledWith((3 - 1) * 5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({ data: mockArticles, total: mockCount });
    });

    it("500 on database error", async () => {
      Article.find.mockImplementation(() => { throw new Error("DB fail"); });

      req = { query: {} };
      await getArticles(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to fetch articles" });
    });
  });

  describe("getArticleById()", () => {
    it("200 returns article when found", async () => {
      const article = { _id: "abc", title: "Found" };
      Article.findById.mockResolvedValue(article);

      req = { params: { id: "abc" } };
      await getArticleById(req, res);

      expect(Article.findById).toHaveBeenCalledWith("abc");
      expect(res.json).toHaveBeenCalledWith(article);
    });

    it("404 if not found", async () => {
      Article.findById.mockResolvedValue(null);

      req = { params: { id: "does-not-exist" } };
      await getArticleById(req, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Article not found" });
    });

    it("500 on unexpected error", async () => {
      Article.findById.mockRejectedValue(new Error("fail"));

      req = { params: { id: "err" } };
      await getArticleById(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to fetch article" });
    });
  });

  describe("getArticleCount()", () => {
    it("200 returns total count", async () => {
      Article.countDocuments.mockResolvedValue(mockCount);

      req = {};
      await getArticleCount(req, res);

      expect(Article.countDocuments).toHaveBeenCalledWith();
      expect(res.json).toHaveBeenCalledWith({ total: mockCount });
    });

    it("500 on error", async () => {
      Article.countDocuments.mockRejectedValue(new Error("fail"));

      req = {};
      await getArticleCount(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to fetch article count" });
    });
  });

  describe("searchArticles()", () => {
    it("200 returns matching results", async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort:   jest.fn().mockReturnThis(),
        skip:   jest.fn().mockReturnThis(),
        limit:  jest.fn().mockResolvedValue(mockArticles),
      };
      Article.find.mockReturnValue(chain);
      Article.countDocuments.mockResolvedValue(mockCount);

      req = { query: { q: "foo", page: "2", limit: "4" } };
      await searchArticles(req, res);

      expect(Article.find).toHaveBeenCalledWith({
        $or: [
          { title:   { $regex: "foo", $options: "i" } },
          { summary: { $regex: "foo", $options: "i" } },
          { topics:  { $regex: "foo", $options: "i" } },
        ],
      });
      expect(chain.skip).toHaveBeenCalledWith((2 - 1) * 4);
      expect(chain.limit).toHaveBeenCalledWith(4);
      expect(res.json).toHaveBeenCalledWith({ data: mockArticles, total: mockCount });
    });

    it("500 on error", async () => {
      Article.find.mockImplementation(() => { throw new Error("fail"); });

      req = { query: {} };
      await searchArticles(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to search articles" });
    });
  });

  describe("getAllTopics()", () => {
    it("200 returns distinct topics", async () => {
      const topics = ["tech", "health"];
      Article.distinct.mockResolvedValue(topics);

      req = {};
      await getAllTopics(req, res);

      expect(Article.distinct).toHaveBeenCalledWith("topics");
      expect(res.json).toHaveBeenCalledWith({ data: topics });
    });

    it("500 on error", async () => {
      Article.distinct.mockRejectedValue(new Error("fail"));

      req = {};
      await getAllTopics(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to fetch topics" });
    });
  });

  describe("getArticlesByTopic()", () => {
    it("200 aggregates and returns filtered articles", async () => {
      Article.aggregate
        .mockResolvedValueOnce(mockArticles)            // first call: data
        .mockResolvedValueOnce([{ total: mockCount }]); // second call: count

      req = {
        params: { topic: "SomeTopic" },
        query:  { page: "2", limit: "3" },
      };
      await getArticlesByTopic(req, res);

      expect(Article.aggregate).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ data: mockArticles, total: mockCount });
    });

    it("500 on error", async () => {
      Article.aggregate.mockRejectedValue(new Error("fail"));

      req = { params: { topic: "X" }, query: {} };
      await getArticlesByTopic(req, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Failed to fetch articles by topic" });
    });
  });
});
