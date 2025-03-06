import React, { useEffect, useState } from "react";
import { Article } from "../pages";
import ArticleList from "./ArticleList";

export default function AllArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(3); // start from page=3 since 1 & 2 used in SSR
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchArticles(page);
  }, []);

  const fetchArticles = async (pageToLoad: number) => {
    try {
      setLoading(true);
      const res = await fetch(
        `http://localhost:3000/api/articles?page=${pageToLoad}&limit=10`,
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
      <h2 style={{ marginBottom: "1rem" }}>All Articles</h2>
      <ArticleList articles={articles} />

      {hasMore && !loading && (
        <button
          onClick={handleLoadMore}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Load More
        </button>
      )}
      {loading && <p>Loading...</p>}
      {!hasMore && <p>No more articles to load.</p>}
    </div>
  );
}
