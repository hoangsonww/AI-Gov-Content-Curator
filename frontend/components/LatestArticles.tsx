import React from "react";
import { Article } from "../pages";
import ArticleList from "./ArticleList";

interface LatestArticlesProps {
  articles: Article[];
}

export default function LatestArticles({ articles }: LatestArticlesProps) {
  if (!articles || articles.length === 0) {
    return <div className="error-message">No latest articles found.</div>;
  }

  return <ArticleList articles={articles} />;
}
