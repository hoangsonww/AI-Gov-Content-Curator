import axios, { AxiosError, AxiosResponse } from "axios";
import { ArticleData } from "./crawler.service";
import * as dotenv from "dotenv";

dotenv.config();

/* ─────────── constants ─────────── */
const PAGE_SIZE = 100;
const STATIC_EXT_RE =
  /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|eot|ttf|otf|json|webmanifest|xml|rss|atom|mp4|mpeg|mov|zip|gz|pdf)(\?|$)/i;

/* ─────────── NewsAPI key rotation ─────────── */
const NEWS_KEYS = [process.env.NEWS_API_KEY, process.env.NEWS_API_KEY1].filter(
  Boolean,
) as string[];

if (!NEWS_KEYS.length) throw new Error("No NEWS_API_KEY* provided");

let keyIdx = 0;
const nextKey = () => {
  keyIdx = (keyIdx + 1) % NEWS_KEYS.length;
  return NEWS_KEYS[keyIdx];
};

/**
 * Derive a title from the raw title or the body of the article.
 *
 * @param raw - The raw title of the article.
 * @param body - The body of the article.
 */
function deriveTitle(raw: string | undefined, body: string): string {
  const cleaned = raw?.trim() ?? "";
  if (cleaned) return cleaned;

  const firstSentence =
    body.match(/(.{10,120}?[.!?])\s/)?.[1]?.trim() ?? body.slice(0, 80).trim();

  return firstSentence.replace(/\s+/g, " ");
}

/**
 * Fetch data from the NewsAPI with key rotation.
 *
 * @param urlBase - The base URL for the API request.
 */
async function safeGet(urlBase: string): Promise<AxiosResponse<any>> {
  let tries = 0;
  while (tries < NEWS_KEYS.length) {
    const url = `${urlBase}&apiKey=${NEWS_KEYS[keyIdx]}`;
    try {
      return await axios.get(url);
    } catch (err) {
      const ax = err as AxiosError<any>;
      const status = ax.response?.status || 0;
      if (status === 401 || status === 429) {
        console.warn(
          `🔑 rotate NewsAPI key → ${(keyIdx + 1) % NEWS_KEYS.length}`,
        );
        nextKey();
        tries++;
        continue;
      }
      throw err;
    }
  }
  throw new Error("All NewsAPI keys exhausted");
}

/**
 * Fetch articles from the NewsAPI.
 *
 * @returns A promise that resolves to an array of article data.
 */
export const fetchArticlesFromNewsAPI = async (): Promise<ArticleData[]> => {
  /* trusted domains & query */
  const domains =
    "nytimes.com,washingtonpost.com,dallasnews.com,statesman.com,houstonchronicle.com,expressnews.com";
  const query = encodeURIComponent("politics OR government OR election");
  const base =
    `https://newsapi.org/v2/everything?language=en&q=${query}` +
    `&sortBy=publishedAt&domains=${domains}&pageSize=${PAGE_SIZE}`;

  /* ── first page ── */
  const firstResp = await safeGet(`${base}&page=1`);
  const total = firstResp.data.totalResults || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const first: ArticleData[] = firstResp.data.articles
    .filter((a: any) => !STATIC_EXT_RE.test(a.url) && !a.url.includes("#"))
    .map((a: any) => {
      const body = a.content || a.description || "";
      return {
        url: a.url,
        title: deriveTitle(a.title, body),
        content: body,
        source: a.source.name || "NewsAPI",
      };
    });

  /* ── remaining pages (batched) ── */
  const pages: number[] = [];
  for (let p = 2; p <= totalPages; p++) pages.push(p);

  const chunks: ArticleData[][] = [];
  const CONC = 5; // concurrent requests per batch

  for (let i = 0; i < pages.length; i += CONC) {
    const batch = pages.slice(i, i + CONC);
    const resps = await Promise.all(
      batch.map(async (page) => {
        const resp = await safeGet(`${base}&page=${page}`);
        return resp.data.articles
          .filter(
            (x: any) => !STATIC_EXT_RE.test(x.url) && !x.url.includes("#"),
          )
          .map((x: any) => {
            const body = x.content || x.description || "";
            return {
              url: x.url,
              title: deriveTitle(x.title, body),
              content: body,
              source: x.source.name || "NewsAPI",
            };
          });
      }),
    );
    chunks.push(...resps);
  }

  return [...first, ...chunks.flat()];
};
