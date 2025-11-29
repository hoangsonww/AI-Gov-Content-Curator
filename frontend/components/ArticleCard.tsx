import React, { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  MdOutlineArrowForwardIos,
  MdFavorite,
  MdFavoriteBorder,
} from "react-icons/md";
import { Article } from "../pages/home";
import {
  fetchFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../services/api";
import { toast } from "react-toastify";
import LanguageIndicator from "./LanguageIndicator";

const ArrowIcon = MdOutlineArrowForwardIos as React.FC<{ size?: number }>;

interface ArticleCardProps {
  article: Article;
}

// an in-memory and localStorage-backed cache to avoid repeated API calls for
// thousands of articles
let cachedFavIds: string[] | null = null;
async function loadFavCache(token: string): Promise<string[]> {
  if (cachedFavIds) return cachedFavIds;
  const fromStorage = localStorage.getItem("favIds");
  if (fromStorage) {
    try {
      cachedFavIds = JSON.parse(fromStorage) as string[];
      return cachedFavIds!;
    } catch {}
  }
  // if not in storage, fetch once
  const fetched = await fetchFavoriteArticleIds(token);
  cachedFavIds = fetched;
  localStorage.setItem("favIds", JSON.stringify(fetched));
  return fetched;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [favLoading, setFavLoading] = useState<boolean>(false);

  const truncateSummary = (text: string, maxLength: number = 250) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);

    // load the favorites cache once, then check membership
    loadFavCache(token)
      .then((ids) => {
        setIsFavorited(ids.includes(article._id));
      })
      .catch((err) => {
        console.error("Error loading favorites", err);
      });
  }, [article._id]);

  // Listen for cache updates from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "favIds" && e.newValue) {
        try {
          const newIds = JSON.parse(e.newValue) as string[];
          cachedFavIds = newIds;
          setIsFavorited(newIds.includes(article._id));
        } catch {}
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.favIds) {
        cachedFavIds = customEvent.detail.favIds;
        setIsFavorited(customEvent.detail.favIds.includes(article._id));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("favCacheUpdated", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("favCacheUpdated", handleCustomEvent);
    };
  }, [article._id]);

  const handleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setFavLoading(true);
    const wasFavorited = isFavorited;
    try {
      await toggleFavoriteArticle(token, article._id);
      setIsFavorited((prev) => {
        const next = !prev;
        // update cache in‐memory and in localStorage
        if (cachedFavIds) {
          if (next) {
            cachedFavIds.push(article._id);
          } else {
            cachedFavIds = cachedFavIds.filter((id) => id !== article._id);
          }
          localStorage.setItem("favIds", JSON.stringify(cachedFavIds));

          // Dispatch custom event to notify other components
          window.dispatchEvent(
            new CustomEvent("favCacheUpdated", {
              detail: { favIds: cachedFavIds },
            }),
          );
        }
        return next;
      });
      toast(`Article ${wasFavorited ? "unfavorited 💔" : "favorited ❤️"}`);
    } catch (err) {
      console.error("Error toggling favorite", err);
      toast.error("Error toggling favorite");
    } finally {
      setFavLoading(false);
    }
  };

  const title = article.title?.trim() || "Article Title Unavailable";
  const topTopics = article.topics?.slice(0, 3) || [];

  const handleCardClick = () => {
    window.location.href = `/articles/${article._id}`;
  };

  const handleTopicClick = (e: React.MouseEvent, topic: string) => {
    e.stopPropagation();
    window.location.href = `/home?topic=${encodeURIComponent(topic)}`;
  };

  return (
    <>
      <div
        className="article-card hover-animate"
        style={{ position: "relative" }}
        onClick={handleCardClick}
      >
        <div className="article-header">
          <h2 className="article-title">{title}</h2>
          <LanguageIndicator
            language={article.language}
            languageName={article.languageName}
            compact={true}
          />
        </div>

        {article.summary && (
          <div className="article-summary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {truncateSummary(article.summary)}
            </ReactMarkdown>
          </div>
        )}

        {topTopics.length > 0 && (
          <div className="article-topics">
            {topTopics.map((topic, idx) => (
              <span
                key={idx}
                className="topic-badge topic-badge-clickable"
                onClick={(e) => handleTopicClick(e, topic)}
              >
                {topic}
              </span>
            ))}
          </div>
        )}

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

        <div className="article-footer">
          <Link href={`/articles/${article._id}`}>
            <span className="article-readmore">
              Read More <ArrowIcon size={14} />
            </span>
          </Link>

          {isLoggedIn && (
            <button
              className="favorite-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleFavorite();
              }}
              aria-label="Favorite Article"
              disabled={favLoading}
              style={{ position: "static" }}
            >
              {favLoading ? (
                <div className="fav-spinner" />
              ) : isFavorited ? (
                <MdFavorite size={20} color="#e74c3c" />
              ) : (
                <MdFavoriteBorder size={20} className="fav-icon-outline" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Spinner styles */}
      <style>{`
        .article-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        
        .article-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--card-border);
        }
        
        .fav-icon-outline {
          color: var(--text-color);
          opacity: 0.7;
        }
        
        [data-theme="dark"] .fav-icon-outline {
          color: #ffffff;
          opacity: 0.9;
        }
        
        .fav-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #ccc;
          border-top-color: #333;
          border-radius: 50%;
          animation: fav-spin 0.6s linear infinite;
        }
        
        [data-theme="dark"] .fav-spinner {
          border-color: #555;
          border-top-color: #fff;
        }
        
        @keyframes fav-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
