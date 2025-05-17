import React, { useState, useEffect } from "react";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";
import { useRouter } from "next/router";
import {
  fetchFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../services/api";
import { Article } from "../pages";

interface ArticleDetailProps {
  article: Article;
}

export default function ArticleDetail({ article }: ArticleDetailProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  // Check for token and load favorite status on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);
    const loadFavorites = async () => {
      try {
        const favorites = await fetchFavoriteArticleIds(token);
        setIsFavorited(favorites.includes(article._id));
      } catch (error) {
        console.error("Error loading favorites", error);
      }
    };
    loadFavorites();
  }, [article._id]);

  const handleFavorite = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await toggleFavoriteArticle(token, article._id);
      setIsFavorited((prev) => !prev);
    } catch (error) {
      console.error("Error toggling favorite", error);
    }
  };

  const handleTopicClick = (topic: string) => {
    // Navigate back to the home page with the selected topic in query.
    router.push(`/?topic=${encodeURIComponent(topic)}`);
  };

  let articleTitle = article.title;

  if (article.title.length == 0 || !article.title || article.title === " ") {
    articleTitle = "Article Title Unavailable";
  }

  return (
    <div className="article-detail hover-animate">
      <h1 className="detail-title">{articleTitle}</h1>

      <p className="detail-meta">
        Source:{" "}
        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="article-source-link"
          >
            {article.source}
          </a>
        ) : (
          article.source
        )}
      </p>

      <p className="detail-meta">
        Fetched at: {new Date(article.fetchedAt).toLocaleString()}
      </p>

      <div className="detail-content">{article.content}</div>

      {article.topics && article.topics.length > 0 && (
        <div className="topics-container">
          <h3>Topics:</h3>
          <div className="topics-list">
            {article.topics.map((topic) => (
              <span
                key={topic}
                className="topic-link"
                onClick={() => handleTopicClick(topic)}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {isLoggedIn && (
        <button
          className="favorite-btn"
          onClick={handleFavorite}
          aria-label="Favorite Article"
        >
          {isFavorited ? (
            <MdFavorite size={20} color="#e74c3c" />
          ) : (
            <MdFavoriteBorder size={20} />
          )}
        </button>
      )}
    </div>
  );
}
