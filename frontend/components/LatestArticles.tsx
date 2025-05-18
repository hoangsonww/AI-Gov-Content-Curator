import React from "react";
import { Article } from "../pages/home";
import ArticleList from "./ArticleList";

interface LatestArticlesProps {
  articles: Article[];
  loading?: boolean;
}

export default function LatestArticles({
  articles,
  loading = false,
}: LatestArticlesProps) {
  // 1) Show spinner if we're loading
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div className="spinner" />
      </div>
    );
  }

  // 2) If not loading and no articles, show error
  if (!articles || articles.length === 0) {
    return <div className="error-message">No latest articles found.</div>;
  }

  // 3) Otherwise render the list
  return <ArticleList articles={articles} />;
}
