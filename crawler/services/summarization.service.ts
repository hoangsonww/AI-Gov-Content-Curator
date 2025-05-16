import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const summarizeContent = async (content: string): Promise<string> => {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_AI_API_KEY in environment variables");
  }
  const fullSystemInstruction = process.env.AI_INSTRUCTIONS || "";
  const googleAiApiKey = process.env.GOOGLE_AI_API_KEY;
  const genAI = new GoogleGenerativeAI(googleAiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    systemInstruction: fullSystemInstruction,
  });
  const generationConfig: GenerationConfig = {
    temperature: 1,
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
  const history: Array<any> = [];

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      const chatSession = model.startChat({
        generationConfig,
        safetySettings,
        history: history,
      });
      const result = await chatSession.sendMessage(
        `Summarize the following article:\n\n${content}`,
      );
      if (!result.response || !result.response.text) {
        throw new Error("Failed to get text response from the AI.");
      }
      return result.response.text();
    } catch (error: any) {
      attempt++;
      if (error.status === 429 && attempt < MAX_RETRIES) {
        console.warn(
          `Summarization rate limited. Retrying attempt ${attempt} after ${RETRY_DELAY_MS}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to summarize content after multiple attempts.");
};
