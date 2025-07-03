process.env.MONGODB_URI = "mongodb://localhost/test";

jest.mock('dotenv', () => ({ config: () => ({}) }));
jest.mock('mongoose', () => {
  class DummySchema {}
  const fakeCursor = {
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: true }),
    }),
  };
  const Article = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 5 }),
    find: jest.fn().mockReturnValue({ lean: () => ({ cursor: () => fakeCursor }) }),
    bulkWrite: jest.fn(),
  };
  const conn = { readyState: 0 };
  return {
    __esModule: true,
    default: { Schema: DummySchema, models: {}, model: () => Article, connection: conn, connect: jest.fn(), disconnect: jest.fn() },
    Schema: DummySchema,
    model: () => Article,
    connection: conn,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
});

const mongoose = require('mongoose').default;
const Article = mongoose.model('Article');
const { cleanupArticles } = require('../scripts/cleanData');

describe('cleanupArticles()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 0;
  });

  it('connects, runs Phase 1 deleteMany, skips bulkWrite, then disconnects', async () => {
    await cleanupArticles();

    expect(Article.deleteMany).toHaveBeenCalledTimes(1);    // Phase 1 only
    expect(Article.bulkWrite).not.toHaveBeenCalled();       // Phases 3–6 are no-ops
    expect(mongoose.connect).toHaveBeenCalled();
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it('when alreadyConnected, it does not reconnect or disconnect', async () => {
    mongoose.connection.readyState = 1;
    await cleanupArticles();

    expect(mongoose.connect).not.toHaveBeenCalled();
    expect(mongoose.disconnect).not.toHaveBeenCalled();
  });
});
