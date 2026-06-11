jest.mock("../services/pinecone.service", () => ({
  getEmbedding: jest.fn(),
}));

jest.mock("../utils/redis", () => ({
  getRedisClient: jest.fn(),
}));

const arrayFromBlob = (blob) => {
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const vector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return Array.from(vector);
};

const cosineDistance = (a, b) => {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 || normB === 0) return 1;
  return 1 - dot / (normA * normB);
};

const getMockEmbedding = (text) => {
  const normalized = text.trim().toLowerCase();
  switch (normalized) {
    case "test initialization string":
      return [1, 0, 0, 0];
    case "what is the truck range?":
    case "how far can the truck go?":
      return [0.99, 0.14, 0, 0];
    case "how much cargo can the truck carry?":
      return [0.97, 0.18, 0, 0];
    case "how many seats are inside the truck?":
      return [0, 1, 0, 0];
    default:
      return [0, 0, 1, 0];
  }
};

describe("Semantic cache", () => {
  let cacheModule;
  let redisMock;
  let storedRecords;
  let indexCreated = false;
  let mockGetEmbedding;
  let mockGetRedisClient;
  const threshold = 0.18;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    storedRecords = new Map();
    indexCreated = false;

    const redisModule = require("../utils/redis");
    const embeddingModule = require("../services/pinecone.service");
    mockGetRedisClient = redisModule.getRedisClient;
    mockGetEmbedding = embeddingModule.getEmbedding;

    redisMock = {
      ft: {
        info: jest.fn(async () => {
          if (!indexCreated) {
            const err = new Error("Unknown index name");
            throw err;
          }
          return { indexName: "semantic_cache" };
        }),
        create: jest.fn(async () => {
          indexCreated = true;
          return { ok: "OK" };
        }),
        search: jest.fn(async (_indexName, _query, params) => {
          const userIdMatch = /@userId:\{([^}]+)\}/.exec(_query);
          const articleIdMatch = /@articleId:\{([^}]+)\}/.exec(_query);
          const queryUserId = userIdMatch?.[1];
          const queryArticleId = articleIdMatch?.[1];

          const documents = Array.from(storedRecords.entries())
            .map(([id, record]) => {
              const doc = { id, value: { response: record.response } };
              if (params?.PARAMS?.blob) {
                const vector = arrayFromBlob(params.PARAMS.blob);
                const dist = cosineDistance(vector, record.prompt_vector);
                return { ...doc, record, dist };
              }
              return { ...doc, record };
            })
            .filter(({ record, dist }) => {
              if (queryUserId && record.userId !== queryUserId) return false;
              if (queryArticleId && record.articleId !== queryArticleId) return false;
              if (typeof dist === "number" && dist > threshold) return false;
              return true;
            })
            .sort((a, b) => {
              if (typeof a.dist === "number" && typeof b.dist === "number") {
                return a.dist - b.dist;
              }
              return 0;
            })
            .map(({ id, value }) => ({ id, value }));

          return { total: documents.length, documents };
        }),
      },
      hSet: jest.fn(async (key, values) => {
        storedRecords.set(key, {
          ...values,
          prompt_vector: arrayFromBlob(values.prompt_vector),
        });
        return 1;
      }),
      expire: jest.fn(async () => true),
      del: jest.fn(async (keys) => {
        keys.forEach(key => {
          storedRecords.delete(key);
        });
      })
    };

    mockGetRedisClient.mockReturnValue(redisMock);
    mockGetEmbedding.mockImplementation(async (text) => getMockEmbedding(text));

    cacheModule = require("../services/semanticCache.service");
  });

  it("should hit the cache for the same query string", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const articleId = "article1";
    const prompt = "What is the truck range?";
    const response = "The truck can travel about 300 miles.";

    await cache.set(userId, articleId, prompt, response);

    const reply = await cache.get(userId, articleId, prompt);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBe(response);
    expect(metrics.requests).toBe(1);
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(0);
    expect(metrics.hitRate).toBe(1);
  });

  it("should hit the cache for semantically similar queries", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const articleId = "article1";
    const promptA = "What is the truck range?";
    const responseA = "The truck can travel about 300 miles.";
    const promptB = "How much cargo can the truck carry?";
    const responseB = "It can carry up to 4,000 pounds of cargo.";

    await cache.set(userId, articleId, promptA, responseA);
    await cache.set(userId, articleId, promptB, responseB);

    const sampleQuery = "How far can the truck go?";
    const reply = await cache.get(userId, articleId, sampleQuery);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBe(responseA);
    expect(metrics.requests).toBe(1);
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(0);
    expect(metrics.hitRate).toBe(1);
  });

  it("should not hit the cache for a semantically different query", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const articleId = "article1";
    const promptA = "What is the truck range?";
    const responseA = "The truck can travel about 300 miles.";

    await cache.set(userId, articleId, promptA, responseA);

    const differentQuery = "How many seats are inside the truck?";
    const reply = await cache.get(userId, articleId, differentQuery);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBeNull();
    expect(metrics.requests).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hits).toBe(0);
    expect(metrics.hitRate).toBe(0);
  });

  it("should not hit cache for a similar query from a different user", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const storedUserId = "user1";
    const lookupUserId = "user2";
    const articleId = "article1";
    const promptA = "What is the truck range?";
    const responseA = "The truck can travel about 300 miles.";

    await cache.set(storedUserId, articleId, promptA, responseA);

    const similarQuery = "How far can the truck go?";
    const reply = await cache.get(lookupUserId, articleId, similarQuery);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBeNull();
    expect(metrics.requests).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hits).toBe(0);
  });

  it("should not hit cache for a similar query on a different article", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const storedArticleId = "article1";
    const lookupArticleId = "article2";
    const promptA = "What is the truck range?";
    const responseA = "The truck can travel about 300 miles.";

    await cache.set(userId, storedArticleId, promptA, responseA);

    const similarQuery = "How far can the truck go?";
    const reply = await cache.get(userId, lookupArticleId, similarQuery);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBeNull();
    expect(metrics.requests).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hits).toBe(0);
  });

  it("should not hit the cache if article is deleted", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const articleId = "article1";
    const prompt = "What is the truck range?";
    const response = "The truck can travel about 300 miles.";

    await cache.set(userId, articleId, prompt, response);
    await cache.invalidateArticle(articleId)

    const reply = await cache.get(userId, articleId, prompt);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBe(null);
    expect(metrics.requests).toBe(1);
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(1);
    expect(metrics.hitRate).toBe(0);
  });

  
  it("should not hit the cache if user is deleted", async () => {
    const { createSemanticCache, getSemanticCache, getSemanticCacheMetrics } = cacheModule;
    await createSemanticCache();
    const cache = await getSemanticCache();

    const userId = "user1";
    const articleId = "article1";
    const prompt = "What is the truck range?";
    const response = "The truck can travel about 300 miles.";

    await cache.set(userId, articleId, prompt, response);
    await cache.invalidateUser(userId)

    const reply = await cache.get(userId, articleId, prompt);
    const metrics = getSemanticCacheMetrics();

    expect(reply).toBe(null);
    expect(metrics.requests).toBe(1);
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(1);
    expect(metrics.hitRate).toBe(0);
  });
});


