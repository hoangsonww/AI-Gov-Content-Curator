import React, { useEffect, useState } from "react";
import { Article } from "../pages/home";
import ArticleList from "./ArticleList";
import { getArticles, getTotalArticles } from "../services/api";

export default function AllArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(3);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalArticles, setTotalArticles] = useState<number | null>(null);

  useEffect(() => {
    fetchArticles(page);
    fetchTotalArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchArticles = async (pageToLoad: number) => {
    try {
      setLoading(true);
      const data = await getArticles(pageToLoad, 10);
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

  const fetchTotalArticles = async () => {
    const total = await getTotalArticles(); // Calling helper from api.ts
    console.log(total);
    setTotalArticles(total);
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchArticles(nextPage);
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h1
        className="page-title"
        style={{
          fontSize: "2rem",
          textAlign: "center",
        }}
      >
        All Articles 📚
      </h1>
      <p
        className="subtitle fade-down"
        style={{ textAlign: "center", marginBottom: "1.5rem" }}
      >
        Browse everything we've collected, summarized, and saved for you.
      </p>
      <ArticleList articles={articles} loading={loading} />

      {hasMore && !loading && (
        <button className="load-more-btn" onClick={handleLoadMore}>
          Load More
        </button>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div className="spinner" />
        </div>
      )}

      {!hasMore && (
        <p className="fade-down" style={{ textAlign: "center" }}>
          No more articles to load. More articles coming soon! 🚀
        </p>
      )}

      {/* Displaying article range */}
      {totalArticles !== null && articles.length > 0 && (
        <p
          style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}
        >
          Displaying Articles{" "}
          <strong>
            {articles.length > 0 ? `1 - ${articles.length}` : "0"}
          </strong>{" "}
          of <strong>{totalArticles}</strong>
        </p>
      )}
    </div>
  );
}
