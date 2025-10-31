import React from "react";
import { Article } from "../pages/home";
import ArticleCarousel from "./ArticleCarousel";

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

  // 3) Split articles into two groups for two carousels
  const midPoint = Math.ceil(articles.length / 2);
  const firstHalf = articles.slice(0, midPoint);
  const secondHalf = articles.slice(midPoint);

  // 4) Render two carousels rotating in different directions
  return (
    <div className="latest-articles-carousels">
      <ArticleCarousel
        articles={firstHalf}
        autoRotateInterval={3000}
        direction="left"
      />
      {secondHalf.length > 0 && (
        <ArticleCarousel
          articles={secondHalf}
          autoRotateInterval={3000}
          direction="right"
        />
      )}
    </div>
  );
}
