// Mock the services and models
jest.mock("../services/notification.service", () => ({
  processArticleNotifications: jest.fn(),
  processDailyDigestNotifications: jest.fn(),
}));

jest.mock("../models/article.model", () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

const { processArticleNotifications, processDailyDigestNotifications } = require("../services/notification.service");
const Article = require("../models/article.model");

const {
  processNotifications,
  processNotificationsByUrl,
  processDailyDigest,
} = require("../controllers/notification.controller");

describe("Notification Controller", () => {
  let req, res;

  const mockRequest = (body = {}) => ({ body });
  const mockResponse = () => {
    const r = {};
    r.status = jest.fn().mockReturnValue(r);
    r.json = jest.fn().mockReturnValue(r);
    return r;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
  });

  describe("processNotifications", () => {
    it("should process notifications for a valid article ID", async () => {
      const mockArticle = {
        _id: "article123",
        title: "Test Article",
        content: "Test content",
      };

      Article.findById.mockResolvedValue(mockArticle);
      processArticleNotifications.mockResolvedValue(undefined);

      req = mockRequest({ articleId: "article123" });
      await processNotifications(req, res);

      expect(Article.findById).toHaveBeenCalledWith("article123");
      expect(processArticleNotifications).toHaveBeenCalledWith(mockArticle);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Notifications processed successfully" });
    });

    it("should return 400 if article ID is missing", async () => {
      req = mockRequest({});
      await processNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Article ID is required" });
    });

    it("should return 404 if article not found", async () => {
      Article.findById.mockResolvedValue(null);

      req = mockRequest({ articleId: "nonexistent" });
      await processNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Article not found" });
    });

    it("should handle errors", async () => {
      Article.findById.mockRejectedValue(new Error("Database error"));

      req = mockRequest({ articleId: "article123" });
      await processNotifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Database error" });
    });
  });

  describe("processNotificationsByUrl", () => {
    it("should process notifications for a valid article URL", async () => {
      const mockArticle = {
        _id: "article123",
        url: "https://example.com/article",
        title: "Test Article",
      };

      Article.findOne.mockResolvedValue(mockArticle);
      processArticleNotifications.mockResolvedValue(undefined);

      req = mockRequest({ url: "https://example.com/article" });
      await processNotificationsByUrl(req, res);

      expect(Article.findOne).toHaveBeenCalledWith({ url: "https://example.com/article" });
      expect(processArticleNotifications).toHaveBeenCalledWith(mockArticle);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Notifications processed successfully" });
    });

    it("should return 400 if URL is missing", async () => {
      req = mockRequest({});
      await processNotificationsByUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Article URL is required" });
    });

    it("should return 404 if article not found", async () => {
      Article.findOne.mockResolvedValue(null);

      req = mockRequest({ url: "https://example.com/nonexistent" });
      await processNotificationsByUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Article not found" });
    });
  });

  describe("processDailyDigest", () => {
    it("should process daily digest notifications", async () => {
      processDailyDigestNotifications.mockResolvedValue(undefined);

      req = mockRequest({});
      await processDailyDigest(req, res);

      expect(processDailyDigestNotifications).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ 
        message: "Daily digest notifications processed successfully" 
      });
    });

    it("should handle errors", async () => {
      processDailyDigestNotifications.mockRejectedValue(new Error("Service error"));

      req = mockRequest({});
      await processDailyDigest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Service error" });
    });
  });
});