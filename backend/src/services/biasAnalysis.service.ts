import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { getGeminiModels } from "./geminiModels.service";
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

const MAX_RETRIES_PER_PAIR = 2;
const BACKOFF_MS = 1500;

/* ─────────────────  PARAMS ───────────────── */

const generationConfig: GenerationConfig = {
  temperature: 0.3,
  topP: 0.85,
  topK: 40,
  maxOutputTokens: 2048,
  responseMimeType: "application/json",
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

/* ─────────────────  TYPES ───────────────── */

export interface BiasAnalysisResult {
  politicalLeaning: {
    position:
      | "far-left"
      | "left"
      | "center-left"
      | "center"
      | "center-right"
      | "right"
      | "far-right";
    score: number;
    explanation: string;
  };
  confidence: number;
  isBiased: boolean;
  biasIndicators: string[];
  neutralityScore: number;
  recommendation: string;
}

/* ─────────────────  HELPERS ───────────────── */

const isRateOrQuota = (e: any) =>
  e?.status === 429 || /quota|rate|exceed/i.test(e?.message || "");

const isOverloaded = (e: any) =>
  e?.status === 503 || /overload|unavailable/i.test(e?.message || "");

const createPrompt = (title: string, content: string) => `
Analyze the following article for political bias and leaning. Return a JSON response with the following structure:
{
  "politicalLeaning": {
    "position": "one of: far-left, left, center-left, center, center-right, right, far-right",
    "score": "number from -100 (far-left) to +100 (far-right), with 0 being center",
    "explanation": "brief explanation of why this position was determined"
  },
  "confidence": "percentage as number 0-100 representing confidence in the assessment",
  "isBiased": "boolean indicating if the article shows significant bias",
  "biasIndicators": ["array of specific phrases or patterns that indicate bias"],
  "neutralityScore": "number from 0-100 where 100 is perfectly neutral",
  "recommendation": "brief suggestion for making the content more balanced"
}

Article Title: ${title}

Article Content:
${content}

Analyze carefully for:
- Use of loaded language or emotional appeals
- Selective presentation of facts
- Sources cited and their known biases
- Framing of issues and perspectives presented
- Balance of viewpoints
- Factual accuracy vs opinion
`;

/* ─────────────────  MAIN FUNCTION ───────────────── */

/**
 * Analyze article content for political bias and leaning.
 *
 * @param title - The article title
 * @param content - The article content to analyze
 * @returns Analysis results including political leaning, bias indicators, and confidence
 */
export async function analyzeArticleBias(
  title: string,
  content: string,
): Promise<BiasAnalysisResult> {
  const prompt = createPrompt(title, content);
  const models = await getGeminiModels(API_KEYS);

  for (const key of API_KEYS) {
    for (const model of models) {
      const genAI = new GoogleGenerativeAI(key).getGenerativeModel({
        model,
        systemInstruction:
          "You are an expert political analyst specializing in media bias detection. Analyze articles objectively and provide structured assessments of political leaning and bias indicators. Be fair and balanced in your analysis.",
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

          const parsed = JSON.parse(text) as BiasAnalysisResult;

          // Validate the response structure
          if (
            !parsed.politicalLeaning ||
            typeof parsed.confidence !== "number" ||
            typeof parsed.isBiased !== "boolean"
          ) {
            throw new Error("Invalid response structure from AI");
          }

          return parsed;
        } catch (err: any) {
          if (
            err.message?.includes("Invalid response structure") ||
            err.message?.includes("JSON")
          ) {
            // Try again with same key/model for parsing errors
            continue;
          }

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

  throw new Error("All keys/models exhausted while analyzing bias");
}
