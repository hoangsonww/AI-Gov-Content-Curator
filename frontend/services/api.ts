import { Article } from "../pages/index";

// We may want to set this to an environment variable or another config.
// For now, we'll keep it hard-coded.
const BASE_URL = "https://ai-content-curator-backend.vercel.app/api";

/**
 * Fetches the top 5 articles from the API.
 */
export async function getTopArticles(): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=1&limit=5`);
  if (!res.ok) throw new Error("Failed to fetch top articles");
  const { data } = await res.json();
  return data || [];
}

/**
 * Fetches the latest 10 articles from the API.
 */
export async function getLatestArticles(): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=2&limit=10`);
  if (!res.ok) throw new Error("Failed to fetch latest articles");
  const { data } = await res.json();
  return data || [];
}

/**
 * Fetches all articles from the API.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  const res = await fetch(`${BASE_URL}/articles/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch article with id ${id}`);

  // Expect the API to return the article object directly.
  const article = await res.json();
  return article ? JSON.parse(JSON.stringify(article)) : null;
}

/**
 * Fetches articles from the API, for a given page and limit.
 *
 * @param page The page number to fetch
 * @param limit The number of articles to fetch per page
 */
export async function getArticles(
  page: number,
  limit = 10,
): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch articles for page ${page}`);

  const { data } = await res.json();
  return data || [];
}
