import { getRedisClient } from "../utils/redis";
import { getEmbedding } from "./pinecone.service";
import { randomUUID } from "crypto";
import { RedisClientType } from "redis";

let cache: SemanticCache;

export interface CacheConfig {
  indexName?: string;
  distanceThreshold?: number;
  ttlSeconds?: number;
  embeddingFn?: (text: string) => Promise<number[]>;
}

export class SemanticCache {
  private redis: RedisClientType;
  private distanceThreshold: number;
  private indexName: string;
  private ttlSeconds: number;
  private hitCount: number;
  private missCount: number;
  private requestCount: number;
  private embeddingFn: (text: string) => Promise<number[]>;

  constructor(config: CacheConfig = {}) {
    this.redis = getRedisClient();
    this.distanceThreshold = config.distanceThreshold ?? 0.2;
    this.indexName = config.indexName ?? "semantic_cache";
    this.ttlSeconds = config.ttlSeconds ?? 86400;
    this.hitCount = 0;
    this.missCount = 0;
    this.requestCount = 0;
    this.embeddingFn = config.embeddingFn ?? getEmbedding;
  }

  private normalize(text: string): string {
    return text.trim().toLowerCase().replace(/[\s\n\r\t]+/g, " ");
  }

  async ensureIndexSchema(vectorDimension: number): Promise<void> {
    try {
      await (this.redis as any).ft.info(this.indexName);
    } catch (err: any) {
      const msg = String(err);
      if (msg.includes("SEARCH_INDEX_NOT_FOUND") || msg.includes("Unknown index name")) {
        await (this.redis as any).ft.create(
          this.indexName,
          {
            userId: { type: "TAG" },
            articleId: { type: "TAG" },
            prompt: { type: "TEXT" },
            response: { type: "TEXT" },
            prompt_vector: {
              type: "VECTOR",
              ALGORITHM: "HNSW",
              TYPE: "FLOAT32",
              DIM: vectorDimension,
              DISTANCE_METRIC: "COSINE",
            },
          },
          { ON: "HASH", PREFIX: "ctx_cache:" },
        );
      } else {
        throw err;
      }
    }
  }

  async get(userId: string, articleId: string, rawPrompt: string): Promise<string | null> {
    this.requestCount += 1;
    const cleanPrompt = this.normalize(rawPrompt);
    const vector = await this.embeddingFn(cleanPrompt);
    const maxDistanceStr = this.distanceThreshold.toFixed(4);

    const query = `(@userId:{${userId}} @articleId:{${articleId}}) @prompt_vector:[VECTOR_RANGE ${maxDistanceStr} $blob]=>{$yield_distance_as: dist}`;

    const params = {
      PARAMS: {
        blob: Buffer.from(new Float32Array(vector).buffer),
      },
      SORTBY: { BY: "dist", DIRECTION: "ASC" },
      DIALECT: 2,
      RETURN: ["response"],
    };

    const searchResult = await (this.redis as any).ft.search(this.indexName, query, params);

    if (searchResult && searchResult.total && searchResult.total > 0) {
      const firstDoc = searchResult.documents[0];
      const cachedResponse = (firstDoc?.value?.response ?? firstDoc?.response ?? firstDoc?.payload?.response) as string;
      if (cachedResponse) {
        this.hitCount += 1;
        return cachedResponse;
      }
    }

    this.missCount += 1;
    return null;
  }

  async set(userId: string, articleId: string, rawPrompt: string, response: string): Promise<void> {
    const cleanPrompt = this.normalize(rawPrompt);
    const key = `ctx_cache:${randomUUID()}`;

    const vector = await this.embeddingFn(cleanPrompt);
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

    await this.redis.hSet(key, {
      userId,
      articleId,
      prompt: cleanPrompt,
      response: response,
      prompt_vector: vectorBuffer,
    });
    await this.redis.expire(key, this.ttlSeconds);
  }

  async invalidateArticle(articleId: string): Promise<void> {
    const indexQuery = `@articleId:{${articleId}}`;
    const searchResult = await (this.redis as any).ft.search(this.indexName, indexQuery, { RETURN: [] });
    if (searchResult && searchResult.total && searchResult.total > 0) {
      const targetIds = searchResult.documents.map((doc: any) => doc.id || doc.document || doc.key).filter(Boolean);
      if (targetIds.length > 0) {
        while (targetIds.length) {
          const chunk = targetIds.splice(0, 100);
          await this.redis.del(chunk);
        }
      }
    }
  }

  getMetrics() {
    const hits = this.hitCount;
    const misses = this.missCount;
    const requests = this.requestCount;
    const hitRate = requests > 0 ? hits / requests : 0;
    const missRate = requests > 0 ? misses / requests : 0;
    return { hits, misses, requests, hitRate, missRate };
  }

  resetMetrics() {
    this.hitCount = 0;
    this.missCount = 0;
    this.requestCount = 0;
  }
}

export async function createSemanticCache(config: CacheConfig = {}): Promise<void> {
  try {
    const embeddingFn = config.embeddingFn ?? getEmbedding;
    cache = new SemanticCache({
      distanceThreshold: 0.18,
      ttlSeconds: 86400,
      ...config,
    });
    const sampleVector = await embeddingFn("test initialization string");
    await cache.ensureIndexSchema(sampleVector.length);
    console.log(" Contextual semantic cache initialized.");
  } catch (err) {
    console.error("Failed to create semantic cache:", err);
  }
}

export function getSemanticCache(): (SemanticCache | null) {
  return cache;
}

export function getSemanticCacheMetrics() {

  return cache.getMetrics();
}

export function resetSemanticCacheMetrics() {
  cache?.resetMetrics();
}
