import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

let pinecone: Pinecone | null = null;
let embeddingModel: any = null;

function getPineconeClient() {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      console.warn("PINECONE_API_KEY not configured - vectorization disabled");
      throw new Error("PINECONE_API_KEY is not configured");
    }
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pinecone;
}

function getEmbeddingModel() {
  if (!embeddingModel) {
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.warn("GOOGLE_AI_API_KEY not configured - vectorization disabled");
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    embeddingModel = genAI.getGenerativeModel({
      model: "models/text-embedding-004",
    });
  }
  return embeddingModel;
}

const indexName = process.env.PINECONE_INDEX || "ai-gov-articles";

export interface ArticleVector {
  id: string;
  url: string;
  title: string;
  summary: string;
  topics: string[];
  source: string;
  fetchedAt: Date;
}

async function getEmbedding(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const embedResp = await model.embedContent(text);
  if (
    !embedResp ||
    !embedResp.embedding ||
    !Array.isArray(embedResp.embedding.values)
  ) {
    throw new Error("Invalid embedding response format.");
  }
  return embedResp.embedding.values;
}

export async function upsertArticleVector(article: ArticleVector) {
  try {
    const client = getPineconeClient();
    const index = client.index(indexName);

    const textToEmbed = `${article.title}\n\n${article.summary}`;
    const embedding = await getEmbedding(textToEmbed);

    await index.upsert([
      {
        id: article.id,
        values: embedding,
        metadata: {
          url: article.url,
          title: article.title,
          summary: article.summary,
          topics: article.topics,
          source: article.source,
          fetchedAt: article.fetchedAt.toISOString(),
        },
      },
    ]);

    console.log(`✓ Vectorized article: ${article.id}`);
  } catch (error) {
    console.error(`Error upserting article ${article.id}:`, error);
  }
}
