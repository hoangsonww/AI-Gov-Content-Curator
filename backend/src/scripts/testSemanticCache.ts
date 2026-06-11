import dotenv from "dotenv";
import { connectRedis, disconnectRedis, getRedisClient } from "../utils/redis";
import {
  createSemanticCache,
  getSemanticCache,
  getSemanticCacheMetrics,
  resetSemanticCacheMetrics,
} from "../services/semanticCache.service";

dotenv.config();

async function dummyGetEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim().toLowerCase();
  if (normalized.includes("truck range") || normalized.includes("far can the truck go")) {
    return [0.98, 0.13, 0, 0];
  }
  if (normalized.includes("cargo")) {
    return [0.97, 0.18, 0, 0];
  }
  if (normalized.includes("seats")) {
    return [0, 1, 0, 0];
  }
  return [0, 0, 1, 0];
}

/**
 * Test script for the semantic cache
 * Run with: npx ts-node src/scripts/testSemanticCache.ts
 *
 * Required environment variables:
 *   REDIS_URL (optional, defaults to redis://localhost:6379)
 */

async function testSemanticCache() {
  const articleId = "testarticle1";
  const userIdA = "testuser1";
  const userIdB = "testuser2";
  const promptA = "What is the truck range?";
  const responseA = "The truck can travel about 300 miles.";
  const similarQuery = "How far can the truck go?";
  const differentQuery = "How many seats are inside the truck?";

  try {
    await connectRedis();
    
    await createSemanticCache({ embeddingFn: dummyGetEmbedding });
    const cache = getSemanticCache();
    if (!cache) {
      console.log("❌ Semantic cache did not initialize correctly.");
      return;
    }

    console.log("\n Test 1: Add and retrieve a cached entry");
    await cache.set(userIdA, articleId, promptA, responseA);
    // Debug: list stored keys and show the HSET contents so we can inspect what was written
    try {
      const client = getRedisClient();
      const keys = await client.keys("ctx_cache:*");
      console.log(`   Debug: stored keys count = ${keys.length}`);
      for (const k of keys) {
        const data = await client.hGetAll(k);
        console.log(`   Debug key=${k} fields=${JSON.stringify(data)}`);
      }
    } catch (dbgErr) {
      console.log("   Debug: failed to inspect Redis keys:", (dbgErr as any)?.message || dbgErr);
    }
    const sameReply = await cache.get(userIdA, articleId, promptA);
    if (sameReply === responseA) {
      console.log(" Cache hit for exact prompt retrieval");
    } else {
      console.log("❌ Cache miss for exact prompt retrieval");
      console.log(`   Expected: ${responseA}`);
      console.log(`   Received: ${sameReply}`);
    }

    const metricsAfterExact = getSemanticCacheMetrics();
    console.log(`   Metrics: requests=${metricsAfterExact.requests}, hits=${metricsAfterExact.hits}, misses=${metricsAfterExact.misses}`);
    resetSemanticCacheMetrics();

    console.log("\n Test 2: Retrieve a semantically similar query");
    const similarReply = await cache.get(userIdA, articleId, similarQuery);
    if (similarReply === responseA) {
      console.log(" Cache hit for semantically similar query");
    } else if (similarReply === null) {
      console.log("❌ Cache miss for semantically similar query");
    } else {
      console.log("⚠️ Cache returned a different response than expected");
      console.log(`   Received: ${similarReply}`);
    }
    const metricsAfterSimilar = getSemanticCacheMetrics();
    console.log(`   Metrics: requests=${metricsAfterSimilar.requests}, hits=${metricsAfterSimilar.hits}, misses=${metricsAfterSimilar.misses}`);
    resetSemanticCacheMetrics();

    console.log("\n Test 3: Different query should miss the cache");
    const differentReply = await cache.get(userIdA, articleId, differentQuery);
    if (differentReply === null) {
      console.log(" Cache miss for a semantically different query");
    } else {
      console.log("❌ Expected no cache hit for a different query");
      console.log(`   Received: ${differentReply}`);
    }
    const metricsAfterDifferent = getSemanticCacheMetrics();
    console.log(`   Metrics: requests=${metricsAfterDifferent.requests}, hits=${metricsAfterDifferent.hits}, misses=${metricsAfterDifferent.misses}`);
    resetSemanticCacheMetrics();

    console.log("\n Test 4: Same query from a different user should miss");
    const crossUserReply = await cache.get(userIdB, articleId, similarQuery);
    if (crossUserReply === null) {
      console.log(" Cache miss for a different user");
    } else {
      console.log("❌ Unexpected cache hit for a different user");
      console.log(`   Received: ${crossUserReply}`);
    }

    console.log("\n Test 5: Same query for a different article should miss");
    const crossArticleReply = await cache.get(userIdA, "testarticle2", similarQuery);
    if (crossArticleReply === null) {
      console.log(" Cache miss for a different article");
    } else {
      console.log("❌ Unexpected cache hit for a different article");
      console.log(`   Received: ${crossArticleReply}`);
    }

    console.log("\n Test 6: Query for a deleted article should miss");
    await cache.invalidateArticle(articleId)
    const deletedArticleReply = await cache.get(userIdA, articleId, promptA);
    if (deletedArticleReply === null) {
      console.log(" Cache miss for a deleted article");
    } else {
      console.log("❌ Unexpected cache hit for a deleted article");
      console.log(`   Received: ${deletedArticleReply}`);
    }

    console.log("\n Cleaning up test data...");
    await cache.invalidateArticle("testarticle2");
    console.log(" Test data cleaned up");

    console.log("\n Semantic cache test completed.");
  } catch (error: any) {
    console.error("❌ Semantic cache test failed:", error?.message || error);
  } finally {
    disconnectRedis();
  }
}

testSemanticCache();
