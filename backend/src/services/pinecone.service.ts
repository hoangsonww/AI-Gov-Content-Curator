import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

let pinecone: Pinecone | null = null;
let embeddingModel: any = null;

function getPineconeClient() {
  if (!pinecone) {
    if (!process.env.PINECONE_API_KEY) {
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
    throw error;
  }
}

export async function findSimilarArticles(
  articleId: string,
  limit: number = 6,
): Promise<any[]> {
  try {
    const client = getPineconeClient();
    const index = client.index(indexName);

    const fetchResponse = await index.fetch([articleId]);
    const articleVector = fetchResponse.records[articleId];

    if (!articleVector || !articleVector.values) {
      throw new Error(`Article ${articleId} not found in vector database`);
    }

    const queryResponse = await index.query({
      vector: articleVector.values,
      topK: limit + 1,
      includeMetadata: true,
    });

    const similarArticles = queryResponse.matches
      .filter((match) => match.id !== articleId)
      .slice(0, limit)
      .map((match) => ({
        id: match.id,
        score: match.score,
        ...match.metadata,
      }));

    return similarArticles;
  } catch (error) {
    console.error(`Error finding similar articles for ${articleId}:`, error);
    throw error;
  }
}

export async function deleteArticleVector(articleId: string) {
  try {
    const client = getPineconeClient();
    const index = client.index(indexName);
    await index.deleteOne(articleId);
    console.log(`✓ Deleted vector for article: ${articleId}`);
  } catch (error) {
    console.error(`Error deleting article vector ${articleId}:`, error);
    throw error;
  }
}
