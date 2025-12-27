import { Request, Response, NextFunction } from "express";
import {
  GoogleGenerativeAI,
  GenerationConfig,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import * as dotenv from "dotenv";
import { searchArticles } from "../services/pinecone.service";
import { getGeminiModels } from "../services/geminiModels.service";
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
// Hard ceiling for prompt size (rough char-based proxy for tokens)
const MAX_PROMPT_CHARS = 12000;
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_MSG_CHARS = 600;
const MAX_ARTICLE_SNIPPET_CHARS = 400;
const FALLBACK_SNIPPET_CHARS = 200;
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
 * Remove trailing citation/source lists from prior assistant turns to reduce token usage.
 * Cuts everything after a "SOURCES" header if present.
 */
function stripCitationsSection(text: string): string {
  const idx = text.toUpperCase().indexOf("SOURCES");
  if (idx !== -1) {
    return text.slice(0, idx).trim();
  }
  return text.trim();
}

/**
 * Compact history to fit within a target character budget.
 * Newest messages are kept; each message is truncated to MAX_HISTORY_MSG_CHARS.
 */
function compactHistory(
  history: { role: "user" | "assistant"; text: string }[],
  budget: number,
) {
  let used = 0;
  const compacted: typeof history = [];
  let trimmed = false;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const trimmedText =
      msg.text.length > MAX_HISTORY_MSG_CHARS
        ? msg.text.slice(-MAX_HISTORY_MSG_CHARS)
        : msg.text;
    const msgCost = trimmedText.length;
    if (used + msgCost > budget) {
      trimmed = true;
      break;
    }
    used += msgCost;
    compacted.push({ role: msg.role, text: trimmedText });
    if (used >= budget) {
      trimmed = true;
      break;
    }
  }

  return { compacted: compacted.reverse(), trimmed };
}

/**
 * Detect potential hallucinations in the AI response.
 * Returns an array of warning messages if issues are detected.
 *
 * @param response The AI-generated response text
 * @param citationMetadata Metadata about available sources
 * @param relevantArticles The source articles
 */
function detectHallucinations(
  response: string,
  citationMetadata: any[],
  relevantArticles: any[],
): string[] {
  const warnings: string[] = [];

  // Check 1: Response should have citations if sources are available
  if (citationMetadata.length > 0) {
    const hasCitations = /\[Source \d+\]/i.test(response);
    if (!hasCitations) {
      warnings.push(
        "Response lacks citations despite having available sources",
      );
    }

    // Check 2: Cited sources should exist
    const citationMatches = response.match(/\[Source (\d+(?:,\s*\d+)*)\]/gi);
    if (citationMatches) {
      for (const match of citationMatches) {
        const numbers = match
          .match(/\d+/g)
          ?.map(Number)
          .filter((n) => n > 0);
        if (numbers) {
          for (const num of numbers) {
            if (num > citationMetadata.length) {
              warnings.push(
                `Citation [Source ${num}] references non-existent source`,
              );
            }
          }
        }
      }
    }
  }

  // Check 3: Response should acknowledge lack of sources
  if (citationMetadata.length === 0) {
    const acknowledgesNoSources =
      /don't have|no (specific )?information|not (in|available in) (the )?(available )?(sources|database)/i.test(
        response,
      );
    if (!acknowledgesNoSources && response.length > 50) {
      warnings.push("Response provides information without available sources");
    }
  }

  // Check 4: Detect overly confident language without citations
  const confidentPhrases = [
    /definitely/i,
    /certainly/i,
    /without a doubt/i,
    /it is clear that/i,
    /obviously/i,
    /undoubtedly/i,
  ];

  for (const phrase of confidentPhrases) {
    if (phrase.test(response)) {
      // Check if there's a citation nearby (within 50 chars)
      const matches = Array.from(response.matchAll(new RegExp(phrase, "gi")));
      for (const match of matches) {
        const index = match.index || 0;
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(response.length, index + 50);
        const context = response.substring(contextStart, contextEnd);
        if (!/\[Source \d+\]/i.test(context)) {
          warnings.push(
            "Response uses confident language without nearby citations",
          );
          break;
        }
      }
    }
  }

  // Check 5: Detect numeric claims without citations
  const numericClaims = response.match(
    /\d+%|\d+\s+(percent|million|billion|thousand|dollars)/gi,
  );
  if (numericClaims && numericClaims.length > 0) {
    for (const claim of numericClaims) {
      const index = response.indexOf(claim);
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(response.length, index + 100);
      const context = response.substring(contextStart, contextEnd);
      if (!/\[Source \d+\]/i.test(context)) {
        warnings.push(
          "Response includes specific numbers/statistics without citations",
        );
        break;
      }
    }
  }

  return warnings;
}

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
  const models = await getGeminiModels(API_KEYS);
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
    for (const modelName of models) {
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

/**
 * Handle sitewide chat with streaming responses.
 * Searches relevant articles from Pinecone and streams Gemini responses.
 *
 * @param req The request object containing the user message and chat history.
 * @param res The response object to stream the AI reply.
 * @param next The next middleware function in the stack.
 */
export async function handleSitewideChat(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userMessage, history = [] } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "`userMessage` is required." });
    }

    // Sanitize history → last N valid messages, strip citation lists to save tokens
    const safeHistory = Array.isArray(history)
      ? (history as any[])
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.text === "string",
          )
          .slice(-MAX_HISTORY_MESSAGES)
          .map((m) => ({
            role: m.role,
            text: stripCitationsSection(m.text || ""),
          }))
          .filter((m) => m.text.trim().length > 0)
      : [];
    const orderedHistory = (() => {
      const firstUserIdx = safeHistory.findIndex((m) => m.role === "user");
      if (firstUserIdx === -1) return [];
      return safeHistory.slice(firstUserIdx);
    })();

    // Set up Server-Sent Events headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable buffering in nginx

    // Helper to send SSE events
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const models = await getGeminiModels(API_KEYS);
      // 1. Search for relevant articles using Pinecone
      sendEvent("status", { message: "Searching relevant articles..." });

      const relevantArticles = await searchArticles(userMessage, 5);

      if (relevantArticles.length === 0) {
        sendEvent("context", {
          articles: [],
          message: "No relevant articles found",
        });
      } else {
        sendEvent("context", {
          articles: relevantArticles.map((a) => ({
            id: a.id,
            title: a.title,
            score: a.score,
          })),
        });
      }

      // 2. Build context from retrieved articles with citation metadata
      let contextText = "";
      const citationMetadata: any[] = [];

      if (relevantArticles.length > 0) {
        contextText = relevantArticles
          .map((article, idx) => {
            // @ts-ignore
            const citationNumber = idx + 1;
            citationMetadata.push({
              number: citationNumber,
              id: article.id,
              title: article.title,
              source: article.source,
              url: article.url || "",
              fetchedAt: article.fetchedAt || "",
              score: article.score,
            });

            const summary = (article.summary || article.content || "").slice(
              0,
              MAX_ARTICLE_SNIPPET_CHARS,
            );

            return `[Source ${citationNumber}]\nTitle: ${article.title}\nSummary: ${summary}`;
          })
          .join("\n\n");
      }

      // 3. Create system instruction with context and citation requirements
      const systemInstruction = `
You are ArticleIQ - a highly accurate Q&A assistant for the SynthoraAI - AI Article Content Curator platform.
SynthoraAI provides AI-generated summaries of government and news articles to help public officials and the general public stay informed.

Your role is to help users understand and explore articles from our database. You have access to a wide range of topics and sources, including government websites and news outlets.

${contextText ? `Here are the most relevant articles to help answer the user's question:\n${contextText}` : "I don't have specific articles matching this query. You MUST inform the user that you don't have relevant sources in the database for this query."}

CRITICAL CITATION AND ACCURACY REQUIREMENTS:

1. ALWAYS cite your sources using [Source N] notation when referencing information
2. ONLY use information from the provided sources above
3. If you reference a fact or claim, you MUST cite it like this: "According to the report [Source 1], ..."
4. Use multiple citations when information comes from multiple sources: [Source 1, 2]
5. NEVER make up or invent information not present in the sources
6. If the provided sources don't contain information to answer the question, clearly state: "Based on the available sources, I don't have specific information about [topic]. The sources I have access to cover [brief summary of what sources contain]."
7. Be precise and specific when quoting or paraphrasing sources
8. If you're uncertain about something, explicitly state your uncertainty
9. Distinguish clearly between:
   - Facts from sources (cite them)
   - Your analysis/synthesis of the sources (indicate this)
   - Information you don't have (acknowledge gaps)

RESPONSE FORMAT:
- Provide inline citations throughout your response
- Be conversational but accurate
- Prioritize accuracy over completeness
- If sources conflict, mention both perspectives with citations

Remember: It's better to say "I don't have information about that in the available sources" than to provide uncited or speculative information.
      `.trim();

      // 4. Send citation metadata to frontend
      if (citationMetadata.length > 0) {
        sendEvent("citations", { sources: citationMetadata });
      }

      // 5. Compact history against prompt budget
      const basePromptLength =
        systemInstruction.length + userMessage.length + contextText.length;
      const historyBudget = Math.max(0, MAX_PROMPT_CHARS - basePromptLength);
      const { compacted: compactedHistory, trimmed } = compactHistory(
        orderedHistory,
        historyBudget,
      );

      if (trimmed) {
        sendEvent("status", {
          message: "Compacting conversation history for length...",
        });
      }

      // 6. Stream response from Gemini
      sendEvent("status", { message: "Generating response..." });

      let streamSuccessful = false;
      let fullResponse = "";

      // Try different API keys and models
      for (const apiKey of API_KEYS) {
        if (streamSuccessful) break;

        for (const modelName of models) {
          if (streamSuccessful) break;

          try {
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
              model: modelName,
              systemInstruction,
            });

            const chat = model.startChat({
              generationConfig,
              safetySettings,
              history: compactedHistory.map((m) => ({
                role: m.role,
                parts: [{ text: m.text }],
              })),
            });

            const result = await chat.sendMessageStream(userMessage);

            // Stream the response chunks
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullResponse += chunkText;
                sendEvent("chunk", { text: chunkText });
              }
            }

            streamSuccessful = true;

            // 6. Perform hallucination checks
            const hallucinationWarnings = detectHallucinations(
              fullResponse,
              citationMetadata,
              relevantArticles,
            );

            if (hallucinationWarnings.length > 0) {
              sendEvent("warnings", {
                message: "Quality check detected potential issues",
                warnings: hallucinationWarnings,
              });
            }

            // 7. Send completion with citation list
            sendEvent("done", {
              success: true,
              citationCount: citationMetadata.length,
            });
            break;
          } catch (err) {
            // If rate limit or overload, try next key/model
            if (isRateOrQuota(err) || isOverloaded(err)) {
              continue;
            }
            // For other errors, also continue to try other models
            continue;
          }
        }
      }

      if (!streamSuccessful) {
        // Minimal fallback attempt: short context, no history
        const minimalContext = citationMetadata
          .slice(0, 3)
          .map((c) =>
            `[Source ${c.number}] ${c.title}`.slice(0, FALLBACK_SNIPPET_CHARS),
          )
          .join("\n");

        const minimalInstruction = `
You are ArticleIQ. Provide a concise answer using the provided source titles. If you lack details, say you don't have specifics in the sources.
${minimalContext ? `Sources:\n${minimalContext}` : "No sources available."}
Use [Source N] notation.`.trim();

        let fallbackStreamed = false;
        for (const apiKey of API_KEYS) {
          if (fallbackStreamed) break;
          for (const modelName of models) {
            if (fallbackStreamed) break;
            try {
              const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
                model: modelName,
                systemInstruction: minimalInstruction,
              });
              const result = await model.generateContent(userMessage);
              const text = result.response?.text?.();
              if (text) {
                sendEvent("chunk", { text });
                sendEvent("done", {
                  success: true,
                  citationCount: citationMetadata.length,
                });
                fallbackStreamed = true;
              }
            } catch (err) {
              continue;
            }
          }
        }

        if (!fallbackStreamed) {
          const fallbackText =
            "I don't have additional details from the available sources right now.";
          sendEvent("chunk", { text: fallbackText });
          sendEvent("done", { success: false, citationCount: 0 });
        }
      }
    } catch (error: any) {
      console.error("Error in sitewide chat:", error);
      sendEvent("chunk", {
        text: "I hit a temporary issue processing this request. Please try again in a moment.",
      });
      sendEvent("done", { success: false, citationCount: 0 });
    } finally {
      res.end();
    }
  } catch (err) {
    next(err);
  }
}
