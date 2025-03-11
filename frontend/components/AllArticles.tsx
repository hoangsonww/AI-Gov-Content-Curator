import React, { useEffect, useState } from "react";
import { Article } from "../pages";
import ArticleList from "./ArticleList";
import { getArticles } from "../services/api";

export default function AllArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(3);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchArticles(page);
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
