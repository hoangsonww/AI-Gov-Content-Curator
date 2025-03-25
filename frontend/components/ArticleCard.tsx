import Link from "next/link";
import { Article } from "../pages";
import React, { useState, useEffect } from "react";
import {
  MdOutlineArrowForwardIos,
  MdFavorite,
  MdFavoriteBorder,
} from "react-icons/md";
import {
  fetchFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../services/api";
import { toast } from "react-toastify";

const ArrowIcon = MdOutlineArrowForwardIos as React.FC<{ size?: number }>;

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in and load favorites if so.
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

      toast(`Article ${isFavorited ? "unfavorited 💔" : "favorited ❤️"}`);
    } catch (err) {
      console.error("Error toggling favorite", err);
    }
  };

  return (
    <div
      className="article-card hover-animate"
      style={{ position: "relative" }}
    >
      <h2 className="article-title">{article.title}</h2>
      {article.summary && <p className="article-summary">{article.summary}</p>}

      {/* ✅ Clickable Source Link */}
      <p className="article-source">
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

      <Link href={`/articles/${article._id}`}>
        <span className="article-readmore">
          Read More <ArrowIcon size={14} />
        </span>
      </Link>

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
