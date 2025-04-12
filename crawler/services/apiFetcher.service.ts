import axios from "axios";
import { ArticleData } from "./crawler.service";

export const fetchArticlesFromNewsAPI = async (): Promise<ArticleData[]> => {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEWS_API_KEY");
  }

  // Restrict articles to the specified trusted domains:
  // - New York Times
  // - The Washington Post
  // - Dallas Morning News
  // - Austin American Statesman
  // - Houston Chronicle
  // - San Antonio Express News
  const trustedDomains =
    "nytimes.com,washingtonpost.com,dallasnews.com,statesman.com,houstonchronicle.com,expressnews.com";

  // Use the "everything" endpoint with a broad political query.
  // The query is encoded to ensure proper URL formatting.
  const query = encodeURIComponent("politics OR government OR election");

  const url = `https://newsapi.org/v2/everything?language=en&q=${query}&sortBy=publishedAt&domains=${trustedDomains}&apiKey=${apiKey}`;

  const response = await axios.get(url);
  const articles = response.data.articles;

  return articles.map((a: any) => ({
    url: a.url,
    title: a.title,
    content: a.content || a.description || "",
    source: a.source.name || "NewsAPI",
  }));
};
