import { Request, Response, NextFunction } from "express";
import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

/* ───────── CONFIG ───────── */
const API_KEYS = [
  process.env.GOOGLE_AI_API_KEY,
  process.env.GOOGLE_AI_API_KEY1,
  process.env.GOOGLE_AI_API_KEY2,
  process.env.GOOGLE_AI_API_KEY3,
].filter(Boolean) as string[];

if (!API_KEYS.length)
  throw new Error("No GOOGLE_AI_API_KEY* values provided in env");

const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];
const MAX_RETRIES_PER_PAIR = 2;
const BACKOFF_MS = 1500;

const generationConfig: GenerationConfig = {
  temperature: 0.9,
  topK: 64,
  topP: 0.95,
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

/* ───────── HELPERS ───────── */

/**
 * Check if the error is a rate limit or quota exceeded error.
 *
 * @param e The error object to check.
 */
const isRateOrQuota = (e: unknown) =>
  // @ts‑ignore: rough check is fine
  (e as any)?.status === 429 || /quota|rate|exceed/i.test((e as any)?.message);

/**
 * Check if the error indicates that the service is overloaded or unavailable.
 *
 * @param e The error object to check.
 */
const isOverloaded = (e: unknown) =>
  // @ts‑ignore
  (e as any)?.status === 503 ||
  /overload|unavailable/i.test((e as any)?.message);

/**
 * Ask Gemini a question using the provided article and history.
 *
 * @param article The article to use as context, containing title and content.
 * @param history The chat history, an array of objects with role and text properties.
 * @param userMessage The user's message to send to Gemini.
 */
async function askGemini(
  article: { title: string; content: string },
  history: { role: "user" | "assistant"; text: string }[],
  userMessage: string,
): Promise<string> {
  const systemInstruction = `
    You are ArticleIQ - a helpful Q&A assistant, trained on a wide range of topics.
    You are built by the SynthoraAI - AI Article Content Curator team to assist users in understanding and
    summarizing articles. Use all available information and your expertise to provide
    the most accurate and relevant answers. Your goal is to help users find the information they 
    need quickly and efficiently, without biases or personal opinions.
    
    SynthoraAI is a project that aims to provide AI-generated summaries of government and news articles,
    making it easier for public officials and the general public to stay informed. It includes daily
    summaries of important articles from a wide range of topics and sources, including government websites and news outlets.
    It also provides a user-friendly interface for searching and browsing articles summarized by AI, signing up
    for daily email newsletters, favoriting articles, and more. It is designed to be a comprehensive and reliable source 
    of information for public officials and the general public alike. You are a part of this project,
    and your role is to assist users in understanding and summarizing article(s) specified.
    
    Please also try to make your answers concise, clear, and to the point, and most importantly,
    bias-free. Avoid making assumptions or providing personal opinions.
    
    Use the following article as context.
    
    Title: ${article.title}
    
    ${article.content}`.trim();

  for (const key of API_KEYS) {
    for (const modelName of MODELS) {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAIR; attempt++) {
        try {
          const chat = model.startChat({
            generationConfig,
            safetySettings,
            history: history.map((m) => ({
              role: m.role,
              parts: [{ text: m.text }],
            })),
          });

          const result = await chat.sendMessage(userMessage);
          const text = result.response?.text?.().trim();
          if (!text) throw new Error("Empty Gemini response");
          return text;
        } catch (err) {
          if (
            (isRateOrQuota(err) || isOverloaded(err)) &&
            attempt < MAX_RETRIES_PER_PAIR
          ) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS * attempt));
            continue; // retry same key/model once
          }
          break; // move on to next key/model
        }
      }
    }
  }
  throw new Error("All API keys & models exhausted by Gemini helper");
}

/**
 * Handle chat requests by validating input and calling the Gemini API.
 *
 * @param req The request object containing the article, user message, and chat history.
 * @param res The response object to send the AI reply.
 * @param next The next middleware function in the stack.
 */
export async function handleChat(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { article, userMessage, history = [] } = req.body;

    if (!article || !userMessage) {
      return res
        .status(400)
        .json({ error: "`article` and `userMessage` are required." });
    }

    /* sanitise history → last 10 valid messages */
    const safeHistory = Array.isArray(history)
      ? (history as any[])
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.text === "string",
          )
          .slice(-10)
      : [];

    const reply = await askGemini(article, safeHistory, userMessage);
    return res.json({ reply });
  } catch (err) {
    next(err);
  }
}
