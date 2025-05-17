import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

/* ─────────────────  KEY + MODEL ROTATION ───────────────── */

const API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean) as string[];

if (!API_KEYS.length) throw new Error("No GOOGLE_AI_API_KEY* values found");

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

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
  for (const key of API_KEYS) {
    for (const model of MODELS) {
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
                parts: [{ text: `Summarize briefly:\n\n${article}` }],
              },
            ],
            generationConfig,
            safetySettings,
          });
          const text = result?.response?.text?.().trim();
          if (!text) throw new Error("Empty Gemini response");
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
