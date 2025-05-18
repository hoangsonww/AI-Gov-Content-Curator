import mongoose from "mongoose";
import { sendNewsletter } from "../schedule/sendNewsletter";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";
import Article from "../models/article.model";

jest.mock("mongoose", () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
}));
jest.mock("../models/newsletterSubscriber.model");
jest.mock("../models/article.model");
jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ error: null }),
      },
    })),
  };
});

const mockSubscribers = [
  { email: "a@example.com", lastSentAt: null, save: jest.fn() },
];
const mockArticles = [
  {
    title: "Test Article",
    url: "http://example.com",
    summary: "This is **markdown** summary.",
    fetchedAt: new Date("2025-05-18T00:00:00Z"),
    source: "TestSource",
  },
];

describe("sendNewsletter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGODB_URI = "mongodb://localhost:27017/testdb";
    process.env.RESEND_API_KEY = "test-key";
    process.env.UNSUBSCRIBE_BASE_URL = "http://unsubscribe";
  });

  it("does nothing when there are no new articles", async () => {
    (NewsletterSubscriber.find as jest.Mock).mockResolvedValue([]);
    await expect(sendNewsletter()).resolves.toBeUndefined();
    expect(NewsletterSubscriber.find).toHaveBeenCalled();
    // no disconnect called because it connects then returns early
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it("sends email when there are new articles", async () => {
    (NewsletterSubscriber.find as jest.Mock).mockResolvedValue(mockSubscribers);
    (Article.find as jest.Mock).mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: () => Promise.resolve([...mockArticles, ...mockArticles]), // force trimmed
        }),
      }),
    });

    await sendNewsletter();

    // One subscriber
    expect(NewsletterSubscriber.find).toHaveBeenCalled();
    // Article query since lastSentAt
    expect(Article.find).toHaveBeenCalledWith({
      fetchedAt: { $gt: mockSubscribers[0].lastSentAt ?? new Date(0) },
    });
    // Resend client should have been constructed
    // @ts-ignore
    const Resend = require("resend").Resend;
    expect(Resend).toHaveBeenCalledWith("test-key");

    // emails.send called
    const resendInstance = new Resend("test-key");
    expect(resendInstance.emails.send).toHaveBeenCalledTimes(1);
    const sendArgs = resendInstance.emails.send.mock.calls[0][0];
    expect(sendArgs.to).toBe("a@example.com");
    expect(sendArgs.subject).toMatch(/📰 50 new article/);
    expect(sendArgs.html).toContain("AI Article Curator");
    expect(sendArgs.text).toContain("1. Test Article");

    // lastSentAt updated and saved
    expect(mockSubscribers[0].lastSentAt).toBeInstanceOf(Date);
    expect(mockSubscribers[0].save).toHaveBeenCalled();

    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it("respects rate limit delay on error", async () => {
    jest.useFakeTimers();
    (NewsletterSubscriber.find as jest.Mock).mockResolvedValue(mockSubscribers);
    // mock send to return error first
    const { Resend } = require("resend");
    Resend.mockImplementation(() => ({
      emails: {
        send: jest
          .fn()
          .mockResolvedValueOnce({ error: "oops" })
          .mockResolvedValueOnce({ error: null }),
      },
    }));
    (Article.find as jest.Mock).mockReturnValue({
      sort: () => ({
        limit: () => ({ lean: () => Promise.resolve(mockArticles) }),
      }),
    });

    const promise = sendNewsletter();

    // advance past first send + delay
    await Promise.resolve();
    jest.advanceTimersByTime(500);
    // advance past second send + delay
    await Promise.resolve();
    jest.advanceTimersByTime(500);

    await promise;
    jest.useRealTimers();

    const resendInstance = new Resend("test-key");
    expect(resendInstance.emails.send).toHaveBeenCalledTimes(2);
  });
});
