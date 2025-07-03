process.env.MONGODB_URI = "mongodb://localhost/test";
process.env.RESEND_API_KEY = "fake-key";
process.env.UNSUBSCRIBE_BASE_URL = "http://unsubscribe";

jest.mock('dotenv', () => ({ config: () => ({}) }));
jest.mock('mongoose', () => {
  class Schema { constructor() {} set() {} }
  const connection = { readyState: 1 };
  // Stub Article model; we'll override .find in the test
  const fakeArticleModel = { find: jest.fn() };
  const fakeSubModel = {
    find: jest.fn().mockResolvedValue([{ email: 'a@b.com', lastSentAt: null, save: jest.fn() }]),
  };
  return {
    __esModule: true,
    default: {
      Schema,
      models: {},
      model: jest.fn((name) => name === 'Article' ? fakeArticleModel : fakeSubModel),
      connection,
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
    Schema,
    model: jest.fn((name) => name === 'Article' ? fakeArticleModel : fakeSubModel),
    connection,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
});
jest.mock('../scripts/cleanData', () => ({ cleanupArticles: jest.fn().mockResolvedValue() }));
const sendMock = jest.fn().mockResolvedValue({ error: null });
jest.mock('resend', () => ({ __esModule: true, Resend: jest.fn(() => ({ emails: { send: sendMock } })) }));

const { sendNewsletter } = require('../schedule/sendNewsletter');
const mongoose = require('mongoose').default;
const Article = mongoose.model('Article');

describe('sendNewsletter()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pulls subscribers, sends at least one email, and disconnects', async () => {
    // Arrange: simulate one new article since lastSentAt
    Article.find.mockReturnValue({
      sort: () => ({
        limit: () => ({
          lean: () => [{ url:'u', title:'t', summary:'s', fetchedAt: new Date(), source:'src' }],
        }),
      }),
    });

    // Act & Assert
    await expect(sendNewsletter()).resolves.toBeUndefined();

    expect(mongoose.connect).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalled();
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it('throws if RESEND_API_KEY missing', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendNewsletter()).rejects.toThrow(/RESEND_API_KEY missing/);
  });
});
