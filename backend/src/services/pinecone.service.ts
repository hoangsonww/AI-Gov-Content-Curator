import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Article from "../models/article.model";

let pinecone: Pinecone | null = null;
let embeddingModel: any = null;
const EMBEDDING_MODEL = "models/gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const FALLBACK_MAX_QUERY_CHARS = 160;
const FALLBACK_MAX_KEYWORDS = 10;
const FALLBACK_MIN_KEYWORD_LENGTH = 3;
const FALLBACK_MAX_LIMIT = 20;
const FALLBACK_MIN_CANDIDATE_POOL = 30;
const FALLBACK_MAX_CANDIDATE_POOL = 100;
const TITLE_WEIGHT = 3;
const TOPICS_WEIGHT = 2;
const SUMMARY_WEIGHT = 1;
const TF_SATURATION_K = 1.2;
const TEXT_SCORE_WEIGHT = 0.08;
const RECENCY_WEIGHT = 0.2;
const COVERAGE_WEIGHT = 0.35;
const TITLE_PHRASE_BONUS = 0.45;
const SUMMARY_PHRASE_BONUS = 0.25;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

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
      model: EMBEDDING_MODEL,
    });
  }
  return embeddingModel;
}

const indexName = process.env.PINECONE_INDEX || "ai-gov-articles";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractQueryTerms(query: string): string[] {
  const rawTokens = query.toLowerCase().match(/[a-z0-9]+/g) || [];
  const unique = new Set<string>();
  for (const token of rawTokens) {
    if (
      token.length >= FALLBACK_MIN_KEYWORD_LENGTH &&
      !STOP_WORDS.has(token) &&
      unique.size < FALLBACK_MAX_KEYWORDS
    ) {
      unique.add(token);
    }
  }
  return Array.from(unique);
}

function toTokenList(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (token) =>
      token.length >= FALLBACK_MIN_KEYWORD_LENGTH && !STOP_WORDS.has(token),
  );
}

function accumulateWeightedTokens(
  counter: Map<string, number>,
  tokens: string[],
  weight: number,
) {
  for (const token of tokens) {
    counter.set(token, (counter.get(token) || 0) + weight);
  }
}

function normalizeLimit(limit: number): number {
  return Math.max(1, Math.min(limit || 5, FALLBACK_MAX_LIMIT));
}

function recencyBoost(fetchedAt: unknown): number {
  if (!fetchedAt) return 0;
  const date = new Date(fetchedAt as string);
  if (Number.isNaN(date.getTime())) return 0;
  const ageDays = Math.max(
    0,
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  return 1 / (1 + ageDays / 30);
}

function buildTfMap(article: any): Map<string, number> {
  const tf = new Map<string, number>();
  const titleTokens = toTokenList(article.title || "");
  const summaryTokens = toTokenList(article.summary || "");
  const topicsTokens = Array.isArray(article.topics)
    ? toTokenList(article.topics.join(" "))
    : [];
  accumulateWeightedTokens(tf, titleTokens, TITLE_WEIGHT);
  accumulateWeightedTokens(tf, topicsTokens, TOPICS_WEIGHT);
  accumulateWeightedTokens(tf, summaryTokens, SUMMARY_WEIGHT);
  return tf;
}

function computeTfIdfScore(
  article: any,
  tf: Map<string, number>,
  queryTerms: string[],
  idfByTerm: Map<string, number>,
  baseTextScore: number,
  normalizedQuery: string,
): number {
  let score = 0;
  let matchedTerms = 0;

  for (const term of queryTerms) {
    const termFreq = tf.get(term) || 0;
    if (termFreq <= 0) continue;
    matchedTerms += 1;
    const idf = idfByTerm.get(term) || 1;
    score += (termFreq / (termFreq + TF_SATURATION_K)) * idf;
  }

  if (queryTerms.length > 0) {
    score += (matchedTerms / queryTerms.length) * COVERAGE_WEIGHT;
  }

  const titleLower = String(article.title || "").toLowerCase();
  const summaryLower = String(article.summary || "").toLowerCase();
  if (normalizedQuery && titleLower.includes(normalizedQuery)) {
    score += TITLE_PHRASE_BONUS;
  } else if (normalizedQuery && summaryLower.includes(normalizedQuery)) {
    score += SUMMARY_PHRASE_BONUS;
  }

  score += Math.max(0, baseTextScore) * TEXT_SCORE_WEIGHT;
  score += recencyBoost(article.fetchedAt) * RECENCY_WEIGHT;
  return score;
}

function buildTextProjection() {
  return {
    url: 1,
    title: 1,
    summary: 1,
    topics: 1,
    source: 1,
    fetchedAt: 1,
    score: { $meta: "textScore" },
  };
}

function buildCoreProjection() {
  return {
    url: 1,
    title: 1,
    summary: 1,
    topics: 1,
    source: 1,
    fetchedAt: 1,
  };
}

function rerankFallbackCandidates(
  candidates: any[],
  queryTerms: string[],
  normalizedQuery: string,
  limit: number,
): any[] {
  if (candidates.length === 0) return [];
  if (queryTerms.length === 0) return candidates.slice(0, limit);

  const docTermMaps = candidates.map((row) => buildTfMap(row));
  const documentFrequency = new Map<string, number>();

  for (const term of queryTerms) {
    let docsWithTerm = 0;
    for (const tf of docTermMaps) {
      if ((tf.get(term) || 0) > 0) docsWithTerm += 1;
    }
    documentFrequency.set(term, docsWithTerm);
  }

  const totalDocs = candidates.length;
  const idfByTerm = new Map<string, number>();
  for (const term of queryTerms) {
    const df = documentFrequency.get(term) || 0;
    const idf = Math.log((totalDocs + 1) / (df + 0.5)) + 1;
    idfByTerm.set(term, idf);
  }

  return candidates
    .map((row, idx) => {
      const tf = docTermMaps[idx];
      const baseTextScore = typeof row.score === "number" ? row.score : 0;
      const score = computeTfIdfScore(
        row,
        tf,
        queryTerms,
        idfByTerm,
        baseTextScore,
        normalizedQuery,
      );
      return { ...row, _fallbackScore: score };
    })
    .sort((a, b) => (b._fallbackScore || 0) - (a._fallbackScore || 0))
    .slice(0, limit);
}

function mapArticleRowToResult(article: any, score: number | null = null) {
  return {
    id: String(article._id),
    score,
    url: article.url,
    title: article.title,
    summary: article.summary,
    topics: article.topics,
    source: article.source,
    fetchedAt: article.fetchedAt,
  };
}

async function searchArticlesLexicalFallback(
  query: string,
  limit: number,
): Promise<any[]> {
  const normalizedLimit = normalizeLimit(limit);
  const trimmedQuery = (query || "").trim().slice(0, FALLBACK_MAX_QUERY_CHARS);
  if (!trimmedQuery) return [];

  const queryTerms = extractQueryTerms(trimmedQuery);
  const queryKeywords = queryTerms.join(" ");
  const normalizedQuery = trimmedQuery.toLowerCase();
  const candidatePoolSize = Math.min(
    FALLBACK_MAX_CANDIDATE_POOL,
    Math.max(FALLBACK_MIN_CANDIDATE_POOL, normalizedLimit * 8),
  );
  const byId = new Map<string, any>();

  const mergeCandidates = (rows: any[]) => {
    for (const row of rows) {
      const id = String(row._id);
      if (!byId.has(id)) {
        byId.set(id, row);
        continue;
      }
      const current = byId.get(id);
      const currentScore =
        typeof current?.score === "number" ? current.score : -1;
      const incomingScore = typeof row?.score === "number" ? row.score : -1;
      if (incomingScore > currentScore) {
        byId.set(id, row);
      }
    }
  };

  // 1) Candidate retrieval via text index.
  if (queryKeywords) {
    try {
      const textRows = await Article.find(
        { $text: { $search: queryKeywords } },
        buildTextProjection(),
      )
        .sort({ score: { $meta: "textScore" }, fetchedAt: -1 })
        .limit(candidatePoolSize)
        .lean();
      mergeCandidates(textRows);
    } catch (error) {
      console.error("Mongo text-index fallback failed:", error);
    }
  }

  // 2) Candidate retrieval via regex on title/summary/topics.
  const regexTerms = queryTerms.length > 0 ? queryTerms : [trimmedQuery];
  const safeRegexQuery = regexTerms.map(escapeRegExp).join("|");
  try {
    const regexRows = await Article.find({
      $or: [
        { title: { $regex: safeRegexQuery, $options: "i" } },
        { summary: { $regex: safeRegexQuery, $options: "i" } },
        { topics: { $regex: safeRegexQuery, $options: "i" } },
      ],
    })
      .select(buildCoreProjection())
      .sort({ fetchedAt: -1 })
      .limit(candidatePoolSize)
      .lean();
    mergeCandidates(regexRows);
  } catch (error) {
    console.error("Mongo regex fallback failed:", error);
  }

  const mergedCandidates = Array.from(byId.values());
  if (mergedCandidates.length > 0) {
    const ranked = rerankFallbackCandidates(
      mergedCandidates,
      queryTerms,
      normalizedQuery,
      normalizedLimit,
    );
    return ranked.map((row: any) =>
      mapArticleRowToResult(
        row,
        typeof row._fallbackScore === "number"
          ? row._fallbackScore
          : typeof row.score === "number"
            ? row.score
            : null,
      ),
    );
  }

  // 3) Final fallback: most recent articles to keep the chat responsive.
  try {
    const recentRows = await Article.find({})
      .select(buildCoreProjection())
      .sort({ fetchedAt: -1 })
      .limit(normalizedLimit)
      .lean();
    return recentRows.map((row: any) => mapArticleRowToResult(row, null));
  } catch (error) {
    console.error("Mongo recency fallback failed:", error);
    return [];
  }
}

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
  const embedResp = await model.embedContent({
    content: {
      parts: [{ text }],
    },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  });
  if (
    !embedResp ||
    !embedResp.embedding ||
    !Array.isArray(embedResp.embedding.values)
  ) {
    throw new Error("Invalid embedding response format.");
  }
  if (embedResp.embedding.values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, received ${embedResp.embedding.values.length}.`,
    );
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
      console.warn(
        `Article ${articleId} not found in vector database, skipping vector search`,
      );
      return [];
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
    console.error(
      `Vector search failed for ${articleId}, falling back:`,
      error,
    );
    return [];
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

/**
 * Search for articles relevant to a text query using semantic search.
 *
 * @param query The text query to search for
 * @param limit The maximum number of results to return
 * @returns Array of relevant articles with metadata and similarity scores
 */
export async function searchArticles(
  query: string,
  limit: number = 5,
): Promise<any[]> {
  try {
    const client = getPineconeClient();
    const index = client.index(indexName);

    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query);

    // Query Pinecone for similar articles
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
    });

    // Transform results
    const results = queryResponse.matches.map((match) => ({
      id: match.id,
      score: match.score,
      ...match.metadata,
    }));

    return results;
  } catch (error) {
    console.error(`Error searching articles for query "${query}":`, error);
    return searchArticlesLexicalFallback(query, limit);
  }
}
