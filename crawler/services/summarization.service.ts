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
 * Check if the error is due to rate limiting or quota exceeded.
 *
 * @param e - The error object.
 */
const isRateOrQuota = (e: any) =>
  e?.status === 429 || /quota|rate|exceed/i.test(e?.message || "");

/**
 * Check if the error is due to overload or service unavailability.
 *
 * @param e - The error object.
 */
const isOverloaded = (e: any) =>
  e?.status === 503 || /overload|unavailable/i.test(e?.message || "");

/* ─────────────────────────────  CORE GENERATION  ───────────────────────────── */

/**
 * Generate content using Google Generative AI with key/model rotation and retry logic.
 *
 * @param prompt - The prompt to send to the AI model.
 * @returns The generated text.
 */
async function generateContent(prompt: string): Promise<string> {
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
                parts: [{ text: prompt }],
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
  throw new Error("All keys/models exhausted while generating content");
}

/* ─────────────────────────────  EXPORT  ───────────────────────────── */

/**
 * Summarize the content of an article using Google Generative AI.
 *
 * @param article - The article content to summarize.
 * @returns The summarized text.
 */
export async function summarizeContent(article: string): Promise<string> {
  return generateContent(`Summarize briefly:\n\n${article}`);
}

/**
 * Result interface for multi-language summarization
 */
export interface MultiLanguageSummaryResult {
  /** Summary in the original language of the article */
  summaryOriginal: string;
  /** Summary translated to English (if original is not English, otherwise same as summaryOriginal) */
  summaryTranslated: string;
}

/**
 * Summarize the content of an article in its original language and provide an English translation.
 * Uses Google Generative AI for both summarization and translation.
 *
 * @param article - The article content to summarize.
 * @param languageCode - The detected ISO 639-3 language code (e.g., 'eng', 'spa', 'fra').
 * @param languageName - The human-readable language name (e.g., 'English', 'Spanish', 'French').
 * @returns An object containing both the original language summary and the English translation.
 */
export async function summarizeContentMultiLanguage(
  article: string,
  languageCode: string,
  languageName: string,
): Promise<MultiLanguageSummaryResult> {
  const isEnglish = languageCode === "eng";

  // Step 1: Generate summary in the original language
  const originalPrompt = isEnglish
    ? `Summarize briefly:\n\n${article}`
    : `Summarize the following text briefly in ${languageName}. Keep the summary in ${languageName}, do not translate:\n\n${article}`;

  const summaryOriginal = await generateContent(originalPrompt);

  // Step 2: If not English, translate the summary to English
  let summaryTranslated: string;
  if (isEnglish) {
    summaryTranslated = summaryOriginal;
  } else {
    const translationPrompt = `Translate the following ${languageName} text to English. Provide only the translation, no additional commentary:\n\n${summaryOriginal}`;
    summaryTranslated = await generateContent(translationPrompt);
  }

  return {
    summaryOriginal,
    summaryTranslated,
  };
}
