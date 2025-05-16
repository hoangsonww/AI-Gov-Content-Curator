import { createClient, RedisClientType } from "redis";
import * as dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const PROCESSED_SET_KEY = "articles:processed";
const URL_QUEUE_KEY = "articles:queue";

let client: RedisClientType;

/**
 * Connect to Redis.
 */
export async function connectRedis(): Promise<void> {
  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on("error", (err) => {
      console.error("Redis error", err);
    });
    await client.connect();
    console.log(`✅ Connected to Redis at ${REDIS_URL}`);
  }
}

/**
 * Disconnect from Redis.
 */
export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.disconnect();
    console.log("✅ Disconnected from Redis");
  }
}

/**
 * Mark a URL as processed so we never re-fetch it.
 */
export async function markUrlProcessed(url: string): Promise<void> {
  await client.sAdd(PROCESSED_SET_KEY, url);
}

/**
 * Check whether a URL has already been processed.
 */
export async function isUrlProcessed(url: string): Promise<boolean> {
  const isMember = await client.sIsMember(PROCESSED_SET_KEY, url);
  return isMember === 1;
}

/**
 * Enqueue a URL to be processed later.
 */
export async function enqueueUrl(url: string): Promise<void> {
  await client.rPush(URL_QUEUE_KEY, url);
}

/**
 * Dequeue the next URL to process.
 * Returns null if the queue is empty.
 */
export async function dequeueUrl(): Promise<string | null> {
  return await client.lPop(URL_QUEUE_KEY);
}

/**
 * Get the current length of the URL queue.
 */
export async function getQueueLength(): Promise<number> {
  return await client.lLen(URL_QUEUE_KEY);
}

/**
 * Clear both the processed set and the queue.
 */
export async function resetQueueAndSet(): Promise<void> {
  await client.del(PROCESSED_SET_KEY, URL_QUEUE_KEY);
}
