// src/__tests__/pruneArticles.spec.js

// Mock mongoose and Article model
const mockConnect = jest.fn().mockResolvedValue(true);
const mockDisconnect = jest.fn().mockResolvedValue(true);
const mockCountDocuments = jest.fn();
const mockAggregate = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock("mongoose", () => ({
  connect: mockConnect,
  disconnect: mockDisconnect,
}));

jest.mock("../models/article.model", () => ({
  countDocuments: mockCountDocuments,
  aggregate: mockAggregate,
  deleteMany: mockDeleteMany,
}));

// Mock dotenv
jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Set environment variable for tests
process.env.MONGODB_URI = "mongodb://test-db";

const { pruneArticles } = require("../scripts/pruneArticles");

describe("pruneArticles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock implementations
    mockCountDocuments.mockResolvedValue(0);
    mockAggregate.mockResolvedValue([]);
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
  });

  describe("Database Connection", () => {
    it("should connect to MongoDB with correct URI", async () => {
      mockCountDocuments.mockResolvedValue(100);

      await pruneArticles(true);

      expect(mockConnect).toHaveBeenCalledWith("mongodb://test-db");
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("should disconnect from MongoDB after completion", async () => {
      mockCountDocuments.mockResolvedValue(50);

      await pruneArticles(true);

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("Dry Run Mode", () => {
    it("should not delete any articles in dry run mode", async () => {
      mockCountDocuments
        .mockResolvedValueOnce(1000) // Total articles
        .mockResolvedValueOnce(100)  // Old articles
        .mockResolvedValueOnce(50)   // Low quality
        .mockResolvedValueOnce(25);  // Orphaned

      mockAggregate.mockResolvedValue([
        {
          _id: "http://example.com",
          count: 2,
          docs: [
            { id: "id1", fetchedAt: new Date("2024-01-01") },
            { id: "id2", fetchedAt: new Date("2024-01-02") }
          ]
        }
      ]);

      const stats = await pruneArticles(true);

      expect(mockDeleteMany).not.toHaveBeenCalled();
      expect(stats.totalArticles).toBe(1000);
      expect(stats.articlesRemoved).toBe(176); // 1 duplicate + 100 + 50 + 25
      expect(stats.duplicatesRemoved).toBe(1);
      expect(stats.oldArticlesRemoved).toBe(100);
      expect(stats.lowQualityRemoved).toBe(50);
      expect(stats.orphanedRemoved).toBe(25);
    });

    it("should count documents for each phase in dry run", async () => {
      mockCountDocuments
        .mockResolvedValueOnce(500) // Total articles
        .mockResolvedValueOnce(75)  // Old articles
        .mockResolvedValueOnce(30)  // Low quality
        .mockResolvedValueOnce(10); // Orphaned

      mockAggregate.mockResolvedValue([]); // No duplicates

      await pruneArticles(true);

      // Should call countDocuments for total + each phase
      expect(mockCountDocuments).toHaveBeenCalledTimes(4);
    });
  });

  describe("Live Mode", () => {
    it("should delete articles in live mode", async () => {
      mockCountDocuments.mockResolvedValue(800);
      mockAggregate.mockResolvedValue([]);
      mockDeleteMany
        .mockResolvedValueOnce({ deletedCount: 60 }) // Old articles
        .mockResolvedValueOnce({ deletedCount: 25 }) // Low quality
        .mockResolvedValueOnce({ deletedCount: 8 });  // Orphaned

      const stats = await pruneArticles(false);

      expect(mockDeleteMany).toHaveBeenCalledTimes(3);
      expect(stats.oldArticlesRemoved).toBe(60);
      expect(stats.lowQualityRemoved).toBe(25);
      expect(stats.orphanedRemoved).toBe(8);
      expect(stats.articlesRemoved).toBe(93);
    });

    it("should handle duplicate removal in live mode", async () => {
      mockCountDocuments.mockResolvedValue(500);

      // Mock duplicates found
      mockAggregate.mockResolvedValue([
        {
          _id: "http://duplicate1.com",
          count: 3,
          docs: [
            { id: "newest", fetchedAt: new Date("2024-03-01") },
            { id: "middle", fetchedAt: new Date("2024-02-01") },
            { id: "oldest", fetchedAt: new Date("2024-01-01") }
          ]
        },
        {
          _id: "http://duplicate2.com",
          count: 2,
          docs: [
            { id: "newer", fetchedAt: new Date("2024-02-15") },
            { id: "older", fetchedAt: new Date("2024-01-15") }
          ]
        }
      ]);

      mockDeleteMany
        .mockResolvedValueOnce({ deletedCount: 3 }) // Duplicates
        .mockResolvedValueOnce({ deletedCount: 0 }) // Old articles
        .mockResolvedValueOnce({ deletedCount: 0 }) // Low quality
        .mockResolvedValueOnce({ deletedCount: 0 }); // Orphaned

      const stats = await pruneArticles(false);

      expect(stats.duplicatesRemoved).toBe(3);

      // Should delete the older duplicates, keeping the newest
      expect(mockDeleteMany).toHaveBeenNthCalledWith(1, {
        _id: { $in: ["middle", "oldest"] }
      });
      expect(mockDeleteMany).toHaveBeenNthCalledWith(2, {
        _id: { $in: ["older"] }
      });
    });
  });

  describe("Pruning Criteria", () => {
    it("should use correct criteria for old low-engagement articles", async () => {
      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockResolvedValue([]);

      await pruneArticles(false);

      // Check that deleteMany was called with correct old articles criteria
      const oldArticlesCriteria = mockDeleteMany.mock.calls.find(call =>
        call[0].fetchedAt && call[0].$or
      );

      expect(oldArticlesCriteria).toBeTruthy();
      expect(oldArticlesCriteria[0]).toMatchObject({
        fetchedAt: expect.objectContaining({ $lt: expect.any(Date) }),
        $or: [
          { summary: { $exists: false } },
          { summary: "" },
          { topics: { $size: 0 } },
          { content: { $regex: /^.{0,500}$/s } }
        ]
      });
    });

    it("should use correct criteria for low-quality articles", async () => {
      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockResolvedValue([]);

      await pruneArticles(false);

      // Check that deleteMany was called with correct low quality criteria
      // This should be the second call to deleteMany (index 1)
      const lowQualityCall = mockDeleteMany.mock.calls[1];

      expect(lowQualityCall).toBeTruthy();
      expect(lowQualityCall[0].$or).toContainEqual({ content: { $exists: false } });
      expect(lowQualityCall[0].$or).toContainEqual({ content: "" });
      expect(lowQualityCall[0].$or).toContainEqual({ content: { $regex: /^.{0,299}$/s } });
      expect(lowQualityCall[0].$or).toContainEqual({ title: { $exists: false } });
      expect(lowQualityCall[0].$or).toContainEqual({ title: "" });
      expect(lowQualityCall[0].$or).toContainEqual({ title: { $regex: /^.{0,9}$/s } });
    });

    it("should use correct criteria for orphaned articles", async () => {
      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockResolvedValue([]);

      await pruneArticles(false);

      // Check that deleteMany was called with correct orphaned criteria
      // This should be the third call to deleteMany (index 2)
      const orphanedCall = mockDeleteMany.mock.calls[2];

      expect(orphanedCall).toBeTruthy();
      expect(orphanedCall[0].$or).toContainEqual({ url: { $exists: false } });
      expect(orphanedCall[0].$or).toContainEqual({ url: "" });
      expect(orphanedCall[0].$or).toContainEqual({ source: { $exists: false } });
      expect(orphanedCall[0].$or).toContainEqual({ source: "" });
      expect(orphanedCall[0].$or).toContainEqual({ fetchedAt: { $exists: false } });
      expect(orphanedCall[0].$or).toContainEqual({
        url: {
          $regex: /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json|xml|webmanifest|pdf|zip|gz)$/i
        }
      });
    });
  });

  describe("Statistics Calculation", () => {
    it("should calculate correct statistics", async () => {
      mockCountDocuments
        .mockResolvedValueOnce(1500) // Total
        .mockResolvedValueOnce(200)  // Old
        .mockResolvedValueOnce(100)  // Low quality
        .mockResolvedValueOnce(50);  // Orphaned

      mockAggregate.mockResolvedValue([
        {
          _id: "http://test.com",
          count: 2,
          docs: [
            { id: "id1", fetchedAt: new Date("2024-02-01") },
            { id: "id2", fetchedAt: new Date("2024-01-01") }
          ]
        }
      ]);

      const stats = await pruneArticles(true);

      expect(stats.totalArticles).toBe(1500);
      expect(stats.duplicatesRemoved).toBe(1);
      expect(stats.oldArticlesRemoved).toBe(200);
      expect(stats.lowQualityRemoved).toBe(100);
      expect(stats.orphanedRemoved).toBe(50);
      expect(stats.articlesRemoved).toBe(351); // 1 + 200 + 100 + 50
    });

    it("should handle zero results correctly", async () => {
      mockCountDocuments
        .mockResolvedValueOnce(100) // Total
        .mockResolvedValueOnce(0)   // Old
        .mockResolvedValueOnce(0)   // Low quality
        .mockResolvedValueOnce(0);  // Orphaned

      mockAggregate.mockResolvedValue([]); // No duplicates

      const stats = await pruneArticles(true);

      expect(stats.articlesRemoved).toBe(0);
      expect(stats.duplicatesRemoved).toBe(0);
      expect(stats.oldArticlesRemoved).toBe(0);
      expect(stats.lowQualityRemoved).toBe(0);
      expect(stats.orphanedRemoved).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      mockConnect.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(pruneArticles(true)).rejects.toThrow("Connection failed");
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it("should handle deletion errors gracefully", async () => {
      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockResolvedValue([]);
      mockDeleteMany.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(pruneArticles(false)).rejects.toThrow("Delete failed");
    });

    it("should handle aggregation errors", async () => {
      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockRejectedValueOnce(new Error("Aggregate failed"));

      await expect(pruneArticles(true)).rejects.toThrow("Aggregate failed");
    });
  });

  describe("Date Calculations", () => {
    it("should use correct date thresholds", async () => {
      const mockDate = new Date("2024-03-15T10:00:00Z");
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => mockDate.getTime());

      mockCountDocuments.mockResolvedValue(100);
      mockAggregate.mockResolvedValue([]);

      await pruneArticles(false);

      // Check that the cutoff dates are calculated correctly
      // 90 days ago from mock date should be around Dec 15, 2023
      const expectedDate90 = new Date(mockDate.getTime() - (90 * 24 * 60 * 60 * 1000));
      const expectedDate30 = new Date(mockDate.getTime() - (30 * 24 * 60 * 60 * 1000));

      // Verify old articles criteria uses 90-day cutoff
      const oldCall = mockDeleteMany.mock.calls.find(call => call[0].fetchedAt);
      expect(oldCall[0].fetchedAt.$lt.getTime()).toBeCloseTo(expectedDate90.getTime(), -1000);

      Date.now = originalDateNow;
    });
  });
});