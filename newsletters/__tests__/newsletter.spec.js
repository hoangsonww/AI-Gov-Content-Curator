process.env.MONGODB_URI = "mongodb://localhost/test";
process.env.RESEND_API_KEY = "fake-key";
process.env.UNSUBSCRIBE_BASE_URL = "http://unsubscribe";

jest.mock("dotenv", () => ({ config: () => ({}) }));
jest.mock("mongoose", () => {
  class Schema {
    constructor() {}
    set() {}
  }
  const connection = { readyState: 1 };
  // Stub Article model; we'll override .find in the test
  const fakeArticleModel = { find: jest.fn() };
  const fakeSubModel = {
    find: jest
      .fn()
      .mockResolvedValue([
        { email: "a@b.com", lastSentAt: null, save: jest.fn(), alertFrequency: 'hourly' },
      ]),
  };
  return {
    __esModule: true,
    default: {
      Schema,
      models: {},
      model: jest.fn((name) =>
        name === "Article" ? fakeArticleModel : fakeSubModel,
      ),
      connection,
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    Schema,
    model: jest.fn((name) =>
      name === "Article" ? fakeArticleModel : fakeSubModel,
    ),
    connection,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
});
jest.mock("../scripts/cleanData", () => ({
  cleanupArticles: jest.fn().mockResolvedValue(),
}));
const sendMock = jest.fn().mockResolvedValue({ error: null });
jest.mock("resend", () => ({
  __esModule: true,
  Resend: jest.fn(() => ({ emails: { send: sendMock } })),
}));

const { sendNewsletter } = require("../schedule/sendNewsletter");
const mongoose = require("mongoose").default;
const Article = mongoose.model("Article");
const NewsletterSubscriber = mongoose.model("NewsletterSubscriber")

const SEC_TO_MS = 1000;
const oneHour = 60 * 60 * SEC_TO_MS
const oneDay = 24 * 60 * 60 * SEC_TO_MS;
const oneWeek = oneDay * 7;
const oneMonth = oneWeek * 4;

const today = Date.now()

// Frequency → milliseconds
const frequencyWindows = {
  hourly: oneHour,
  daily: oneDay,
  weekly: oneWeek,
  monthly: oneMonth, // simplified month
};

// Reusable article mock
function mockOneNewArticle() {
  Article.find.mockReturnValue({
    sort: () => ({
      limit: () => ({
        lean: () => [
          {
            url: "u",
            title: "t",
            summary: "s",
            fetchedAt: new Date(),
            source: "src",
          },
        ],
      }),
    }),
  });
}


describe("sendNewsletter()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Arrange: simulate one new article since lastSentAt
  mockOneNewArticle();

  it("pulls subscribers, sends at least one email, and disconnects", async () => {
    // Act & Assert
    await expect(sendNewsletter()).resolves.toBeUndefined();

    expect(mongoose.connect).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalled();
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  describe("sendNewsletter follows alert frequency settings", () => {
    it("does not send email if alert frequency is never", async () => {
      // Act & Assert
      await expect(sendNewsletter()).resolves.toBeUndefined();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it.each([
      ["hourly"],
      ["daily"],
      ["weekly"],
      ["monthly"],
    ])("does NOT send email when %s frequency window has NOT elapsed", async (frequency) => {
      const window = frequencyWindows[frequency];

      NewsletterSubscriber.find.mockResolvedValue([
        {
          email: "a@b.com",
          lastSentAt: new Date(Date.now() - window + 1000), // too recent
          save: jest.fn(),
          alertFrequency: frequency,
        },
      ]);

      await expect(sendNewsletter()).resolves.toBeUndefined();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it.each([
      ["hourly"],
      ["daily"],
      ["weekly"],
      ["monthly"],
    ])("sends email when %s frequency window HAS elapsed", async (frequency) => {
      const window = frequencyWindows[frequency];

      NewsletterSubscriber.find.mockResolvedValue([
        {
          email: "a@b.com",
          lastSentAt: new Date(Date.now() - window - 1000), // exactly at threshold
          save: jest.fn(),
          alertFrequency: frequency,
        },
      ]);

      await expect(sendNewsletter()).resolves.toBeUndefined();
      expect(sendMock).toHaveBeenCalled();
    });
  });

  it("throws if RESEND_API_KEY missing", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendNewsletter()).rejects.toThrow(/RESEND_API_KEY missing/);
  });
});
