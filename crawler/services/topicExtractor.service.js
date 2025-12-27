"use strict";

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { getGeminiModels } = require("./geminiModels.service");
const dotenv = require("dotenv");
dotenv.config();

/* ── key / model rotation ── */
const API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean);

const MAX_RETRIES_PER_PAIR = 2;
const BACKOFF_MS = 1500;

/* ── params ── */
const SYSTEM = (process.env.AI_INSTRUCTIONS ?? "").trim();

const generationConfig = {
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

const MAX_CONTENT_CHARS = 2000;

/* ── helpers ── */

/**
 * Create a prompt for the AI model.
 *
 * @param text - The input text to extract topics from.
 * @returns The formatted prompt string.
 */
const makePrompt = (text) =>
  "Extract 5-10 concise topics from the following text. " +
  "Return as a comma-separated list (no quotes/brackets):\n\n" +
  text;

/**
 * Clean and deduplicate a string.
 *
 * @param s - The input string to clean.
 */
const clean = (s) =>
  Array.from(
    new Set(
      s
        .split(/[\n,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

/**
 * Check if the error is a rate limit error.
 *
 * @param e - The error object to check.
 */
const isRate = (e) => e?.status === 429 || /quota|rate/i.test(e?.message || "");

/**
 * Check if the error is a server overload or unavailable error.
 *
 * @param e - The error object to check.
 */
const isOverload = (e) =>
  e?.status === 503 || /overload|unavailable/i.test(e?.message || "");

/**
 * Extract topics from a given text using Google Generative AI.
 *
 * @param raw - The raw text to extract topics from.
 */
async function extractTopics(raw) {
  const content =
    raw.length > MAX_CONTENT_CHARS
      ? raw.slice(0, MAX_CONTENT_CHARS) + "..."
      : raw;

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
              { role: "user", parts: [{ text: makePrompt(content) }] },
            ],
            generationConfig,
            safetySettings,
          });
          const out = result?.response?.text?.().trim();
          if (!out) throw new Error("Empty Gemini response");
          return clean(out);
        } catch (err) {
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

module.exports = { extractTopics };
