import React, { useState, useEffect, useRef } from "react";
import {
  searchArticles as searchArticlesHelper,
  getArticlesByTopic,
} from "../services/api";
import { Article } from "../pages/home";
import ArticleList from "./ArticleList";

interface ArticleSearchProps {
  query: string;
  topic: string;
  onClear: () => void;
}

// @ts-ignore
const ArticleSearch: React.FC<ArticleSearchProps> = ({
  query,
  topic,
  onClear,
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // If no query and no topic, clear results.
    if (query.trim() === "" && topic.trim() === "") {
      setArticles([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const fetchArticles = () => {
      if (query.trim() === "" && topic.trim() !== "") {
        // Use dedicated helper when only topic is provided.
        getArticlesByTopic(topic, 1, 10)
          .then((data) => {
            setArticles(data);
            setIsSearching(false);
          })
          .catch((err) => {
            console.error("Error fetching articles by topic:", err);
            setIsSearching(false);
          });
      } else {
        // Otherwise, use the general search endpoint.
        searchArticlesHelper(query, topic, 1, 10)
          .then((data) => {
            setArticles(data);
            setIsSearching(false);
          })
          .catch((err) => {
            console.error("Error searching articles:", err);
            setIsSearching(false);
          });
      }
    };

    // No debounce on initial mount (page load with URL params)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchArticles();
      return;
    }

    // Apply debounce for subsequent changes (user typing)
    const handler = setTimeout(fetchArticles, 500);
    return () => clearTimeout(handler);
  }, [query, topic]);

  return (
    <div className="article-search-results">
      <div className="search-header">
        <h2>Search Results 🔍</h2>
        {(query.trim() || topic.trim()) && (
          <p className="search-subtitle">
            {query.trim() && `Results for "${query}"`}
            {query.trim() && topic.trim() && " and "}
            {topic.trim() && `Topic: ${topic}`}
          </p>
        )}
        <button onClick={onClear} className="clear-btn">
          Clear Search
        </button>
      </div>
      {isSearching ? (
        <div className="loading-message">Searching...</div>
      ) : articles.length > 0 ? (
        <ArticleList articles={articles} />
      ) : (
        <div className="no-results">No articles found.</div>
      )}
    </div>
  );
};

export default ArticleSearch;
