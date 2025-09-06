// Mock the models and services
jest.mock("../models/subscription.model", () => ({
  find: jest.fn(),
}));

jest.mock("../services/email.service", () => ({
  sendNotificationEmail: jest.fn(),
}));

const Subscription = require("../models/subscription.model");
const { sendNotificationEmail } = require("../services/email.service");

const {
  doesArticleMatchSubscription,
  processArticleNotifications,
} = require("../services/notification.service");

describe("Notification Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("doesArticleMatchSubscription", () => {
    const mockArticle = {
      title: "New Government Policy Announcement",
      content: "The government has announced new healthcare policies...",
      summary: "Government announces new healthcare initiatives",
      topics: ["government", "healthcare"],
      source: "whitehouse.gov",
    };

    it("should match by topics", () => {
      const subscription = {
        topics: ["government", "politics"],
        keywords: [],
        sources: [],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });

    it("should match by keywords in title", () => {
      const subscription = {
        topics: [],
        keywords: ["policy", "announcement"],
        sources: [],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });

    it("should match by keywords in content", () => {
      const subscription = {
        topics: [],
        keywords: ["healthcare"],
        sources: [],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });

    it("should match by source", () => {
      const subscription = {
        topics: [],
        keywords: [],
        sources: ["whitehouse.gov"],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });

    it("should not match when no criteria match", () => {
      const subscription = {
        topics: ["sports"],
        keywords: ["basketball"],
        sources: ["espn.com"],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(false);
    });

    it("should handle case insensitive matching", () => {
      const subscription = {
        topics: ["GOVERNMENT"],
        keywords: ["HEALTHCARE"],
        sources: ["WHITEHOUSE.GOV"],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });

    it("should handle partial source matching", () => {
      const subscription = {
        topics: [],
        keywords: [],
        sources: ["whitehouse"],
      };

      const result = doesArticleMatchSubscription(mockArticle, subscription);
      expect(result).toBe(true);
    });
  });

  describe("processArticleNotifications", () => {
    const mockArticle = {
      _id: "article123",
      title: "Test Article",
      content: "Test content",
      summary: "Test summary",
      topics: ["government"],
      source: "test.gov",
    };

    it("should send email notifications for matching subscriptions", async () => {
      const mockSubscriptions = [
        {
          _id: "sub1",
          userId: "user1",
          topics: ["government"],
          keywords: [],
          sources: [],
          mode: "realtime",
          emailEnabled: true,
          pushEnabled: false,
        },
        {
          _id: "sub2",
          userId: "user2",
          topics: ["sports"],
          keywords: [],
          sources: [],
          mode: "realtime",
          emailEnabled: true,
          pushEnabled: false,
        },
      ];

      Subscription.find.mockResolvedValue(mockSubscriptions);
      sendNotificationEmail.mockResolvedValue(undefined);

      await processArticleNotifications(mockArticle);

      // Should find realtime subscriptions
      expect(Subscription.find).toHaveBeenCalledWith({
        mode: "realtime",
        $or: [{ emailEnabled: true }, { pushEnabled: true }],
      });

      // Should send email for matching subscription only
      expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(sendNotificationEmail).toHaveBeenCalledWith({
        article: mockArticle,
        subscriptionId: "sub1",
        userId: "user1",
        notificationType: "email",
      });
    });

    it("should send both email and push notifications when both are enabled", async () => {
      const mockSubscriptions = [
        {
          _id: "sub1",
          userId: "user1",
          topics: ["government"],
          keywords: [],
          sources: [],
          mode: "realtime",
          emailEnabled: true,
          pushEnabled: true,
        },
      ];

      Subscription.find.mockResolvedValue(mockSubscriptions);
      sendNotificationEmail.mockResolvedValue(undefined);

      await processArticleNotifications(mockArticle);

      // Should send both email and push notifications
      expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(sendNotificationEmail).toHaveBeenCalledWith({
        article: mockArticle,
        subscriptionId: "sub1",
        userId: "user1",
        notificationType: "email",
      });
    });

    it("should handle errors gracefully", async () => {
      Subscription.find.mockRejectedValue(new Error("Database error"));
      
      // Should not throw
      await expect(processArticleNotifications(mockArticle)).resolves.not.toThrow();
    });

    it("should not send notifications for non-matching subscriptions", async () => {
      const mockSubscriptions = [
        {
          _id: "sub1",
          userId: "user1",
          topics: ["sports"],
          keywords: ["basketball"],
          sources: ["espn.com"],
          mode: "realtime",
          emailEnabled: true,
          pushEnabled: false,
        },
      ];

      Subscription.find.mockResolvedValue(mockSubscriptions);

      await processArticleNotifications(mockArticle);

      // Should not send any notifications
      expect(sendNotificationEmail).not.toHaveBeenCalled();
    });
  });
});