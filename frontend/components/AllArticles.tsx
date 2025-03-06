import React, { useEffect, useState } from "react";
import { Article } from "../pages";
import ArticleList from "./ArticleList";

export default function AllArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(3); // start from page=3 since pages 1 & 2 are used in SSR
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchArticles(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchArticles = async (pageToLoad: number) => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://ai-content-curator-backend.vercel.app/api/articles?page=${pageToLoad}&limit=10`,
      );
      if (!res.ok) throw new Error("Failed to fetch all articles");

      const { data } = await res.json();
      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        setArticles((prev) => [...prev, ...data]);
      }
    } catch (error) {
      console.error("Error fetching all articles:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchArticles(nextPage);
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2
        style={{ fontSize: "2rem", marginBottom: "1rem", textAlign: "center" }}
      >
        All Articles
      </h2>
      <ArticleList articles={articles} />

      {hasMore && !loading && (
        <button className="load-more-btn" onClick={handleLoadMore}>
          Load More
        </button>
      )}
      {loading && <p style={{ textAlign: "center" }}>Loading...</p>}
      {!hasMore && (
        <p style={{ textAlign: "center" }}>No more articles to load.</p>
      )}
    </div>
  );
}
