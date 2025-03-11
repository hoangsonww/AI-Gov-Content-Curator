import { Article } from "../pages";
import React, { useState, useEffect } from "react";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";

interface ArticleDetailProps {
  article: Article;
}

export default function ArticleDetail({ article }: ArticleDetailProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
        const res = await fetch("http://localhost:3000/api/users/favorites", {
          headers: { Authorization: token },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.favorites && Array.isArray(data.favorites)) {
            setIsFavorited(data.favorites.includes(article._id));
          }
        }
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
      const res = await fetch("http://localhost:3000/api/users/favorite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ articleId: article._id }),
      });
      if (res.ok) {
        setIsFavorited((prev) => !prev);
      }
    } catch (error) {
      console.error("Error toggling favorite", error);
    }
  };

  return (
    <div
      className="article-detail hover-animate"
      style={{ position: "relative" }}
    >
      <h1 className="detail-title">{article.title}</h1>
      <p className="detail-meta">Source: {article.source}</p>
      <p className="detail-meta">
        Fetched at: {new Date(article.fetchedAt).toLocaleString()}
      </p>
      <div className="detail-content">{article.content}</div>

      {isLoggedIn && (
        <button
          className="favorite-btn"
          onClick={handleFavorite}
          aria-label="Favorite Article"
          style={{
            background: "none",
            border: "none",
            position: "absolute",
            top: "8px",
            right: "8px",
            cursor: "pointer",
          }}
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
