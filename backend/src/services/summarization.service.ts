import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { getGeminiModels } from "./geminiModels.service";
import * as dotenv from "dotenv";
import { estimateTokens, recordMetrics } from "../controllers/chat.controller";
import { getSemanticCache, SemanticCache } from "./semanticCache.service";
dotenv.config();

/* ─────────────────  KEY + MODEL ROTATION ───────────────── */

const API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean) as string[];

if (!API_KEYS.length) throw new Error("No GOOGLE_AI_API_KEY* values found");

const MAX_RETRIES_PER_PAIR = 2;
const BACKOFF_MS = 1500;

/* ─────────────────  PARAMS ───────────────── */

const SYSTEM = (process.env.AI_INSTRUCTIONS ?? "").trim();

const generationConfig: GenerationConfig = {
  temperature: 0.9,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
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

/**
 * Check if the error is a rate limit or quota exceeded error.
 *
 * @param e The error object to check.
 */
const isRateOrQuota = (e: any) =>
  e?.status === 429 || /quota|rate|exceed/i.test(e?.message || "");

/**
 * Check if the error indicates that the service is overloaded or unavailable.
 *
 * @param e The error object to check.
 */
const isOverloaded = (e: any) =>
  e?.status === 503 || /overload|unavailable/i.test(e?.message || "");

/**
 * Summarize the content of an article using Google Generative AI.
 *
 * @param article - The article content to summarize.
 * @returns The summarized text.
 */
export async function summarizeContent(article: string): Promise<string> {
  let cache: SemanticCache | null = await getSemanticCache();
  let cachedReply: string | null = null;
  const startTime = process.hrtime.bigint();
  const query = `Summarize briefly:\n\n${article}` 

  if (cache) {
    try {
      cachedReply = await cache.get('none', 'none', query);
    } catch (err) {
      console.error("Semantic cache unavailable for summarizeContent:", err);
    }
  }

  if (cachedReply) {
    const latencyMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    recordMetrics(latencyMs, estimateTokens(query), 0);
    return cachedReply;
  }

  const models = await getGeminiModels(API_KEYS);
  for (const key of API_KEYS) {
    for (const model of models) {
      const genAI = new GoogleGenerativeAI(key).getGenerativeModel({
        model,
        systemInstruction: SYSTEM,
      });

      for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAIR; attempt++) {
        try {
          const result = await genAI.generateContent({
            contents: [
              {
                role: "user",
                parts: [{ text: query }],
              },
            ],
            generationConfig,
            safetySettings,
          });
          const text = result?.response?.text?.().trim();
          if (!text) throw new Error("Empty Gemini response");
          
          const latencyMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
          recordMetrics(latencyMs, estimateTokens(query), estimateTokens(text));

          if (cache) {
            try {
              cache.set('none', 'none', query, text)
            } catch (err) {
              console.error("Failed to write to semantic cache for summarizeContent:", err);
            };
          }

          return text;
        } catch (err: any) {
          if (
            (isRateOrQuota(err) || isOverloaded(err)) &&
            attempt < MAX_RETRIES_PER_PAIR
          ) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
            continue;
          }
        }
      }
    }
  }
  throw new Error("All keys/models exhausted while summarizing");
}
