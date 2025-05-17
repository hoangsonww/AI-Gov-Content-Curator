import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

/* ── key / model rotation ── */
const API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean) as string[];

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const MAX_RETRIES_PER_PAIR = 2;
const BACKOFF_MS = 1500;

/* ── params ── */
const SYSTEM = (process.env.AI_INSTRUCTIONS ?? "").trim();

const generationConfig: GenerationConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 1024,
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

const MAX_CONTENT_CHARS = 2_000;

/* ── helpers ── */

/**
 * Create a prompt for the AI model.
 *
 * @param text - The text to extract topics from.
 */
const makePrompt = (text: string) =>
  `Extract 5‑10 concise topics from the following text. ` +
  `Return as a comma‑separated list (no quotes/brackets):\n\n${text}`;

/**
 * Clean and deduplicate a string.
 *
 * @param s - The string to clean.
 */
const clean = (s: string) =>
  Array.from(
    new Set(
      s
        .split(/[\n,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

/**
 * Check if the error is a rate limit or quota exceeded error.
 *
 * @param e - The error object to check.
 */
const isRate = (e: any) =>
  e?.status === 429 || /quota|rate/i.test(e?.message || "");

/**
 * Check if the error is a server overload or unavailable error.
 *
 * @param e - The error object to check.
 */
const isOverload = (e: any) =>
  e?.status === 503 || /overload|unavailable/i.test(e?.message || "");

/**
 * Extract topics from a given text using Google Generative AI.
 *
 * @param raw - The raw text to extract topics from.
 * @returns A promise that resolves to an array of extracted topics.
 */
export async function extractTopics(raw: string): Promise<string[]> {
  const content =
    raw.length > MAX_CONTENT_CHARS
      ? raw.slice(0, MAX_CONTENT_CHARS) + "…"
      : raw;

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
              { role: "user", parts: [{ text: makePrompt(content) }] },
            ],
            generationConfig,
            safetySettings,
          });
          const out = result?.response?.text?.().trim();
          if (!out) throw new Error("Empty Gemini response");
          return clean(out);
        } catch (err: any) {
          if (
            (isRate(err) || isOverload(err)) &&
            attempt < MAX_RETRIES_PER_PAIR
          ) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
            continue;
          }
        }
      }
    }
  }
  throw new Error("All keys/models exhausted while extracting topics");
}
