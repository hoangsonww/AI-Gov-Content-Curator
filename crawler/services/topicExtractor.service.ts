// services/topicExtractor.service.ts

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

// --- Configuration & singletons ---

const AI_INSTRUCTIONS = process.env.AI_INSTRUCTIONS?.trim() || "";
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
if (!GOOGLE_AI_API_KEY) {
  throw new Error("Missing GOOGLE_AI_API_KEY in environment");
}

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  systemInstruction: AI_INSTRUCTIONS,
});

const generationConfig: GenerationConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 256,
};

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // exponential backoff base
const MAX_CONTENT_CHARS = 2000; // truncate very long content to speed up prompt

/**
 * Extracts topics from article content by calling Google Generative AI.
 * - Reuses the same model instance for speed.
 * - Truncates content to first MAX_CONTENT_CHARS characters.
 * - Applies exponential backoff on rate limits.
 */
export const extractTopics = async (rawContent: string): Promise<string[]> => {
  // Truncate to reduce token usage and speed up
  const content =
    rawContent.length > MAX_CONTENT_CHARS
      ? rawContent.slice(0, MAX_CONTENT_CHARS) + "..."
      : rawContent;

  const prompt = `Extract 5–10 concise topics from the text below. Return as a comma-separated list with no quotes or brackets:\n\n${content}`;

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: [],
      });

      // Race the AI call against a timeout to avoid hangs
      const result = await Promise.race([
        chat.sendMessage(prompt),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("AI request timeout")), 5000),
        ),
      ]);

      const text = result.response?.text?.().trim();
      if (!text) {
        throw new Error("Empty AI response");
      }

      // Split on commas or newlines, trim, dedupe
      const topics = Array.from(
        new Set(
          text
            .split(/[\n,]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0),
        ),
      );

      return topics;
    } catch (err: any) {
      attempt++;
      const isRateLimit = err.status === 429 || /rate limit/i.test(err.message);
      if (isRateLimit && attempt < MAX_RETRIES) {
        const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `Topic extraction rate-limited (attempt ${attempt}), retrying in ${delayMs}ms…`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      // For other errors or if out of retries, rethrow
      throw err;
    }
  }
  throw new Error("Failed to extract topics after multiple attempts");
};
