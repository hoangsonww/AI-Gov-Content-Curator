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

  const handleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setFavLoading(true);
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
        }
        return next;
      });
      toast(`Article ${isFavorited ? "unfavorited 💔" : "favorited ❤️"}`);
    } catch (err) {
      console.error("Error toggling favorite", err);
      toast.error("Error toggling favorite");
    } finally {
      setFavLoading(false);
    }
  };

  const title = article.title?.trim() || "Article Title Unavailable";

  return (
    <>
      <div
        className="article-card hover-animate"
        style={{ position: "relative" }}
      >
        <h2 className="article-title">{title}</h2>

        {article.summary && (
          <div className="article-summary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={{
                ul: ({ node, ...props }) => (
                  <ul
                    style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}
                    {...props}
                  />
                ),
                ol: ({ node, ...props }) => (
                  <ol
                    style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => (
                  <li style={{ margin: "0.25em 0" }} {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div style={{ overflowX: "auto", margin: "1em 0" }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                      {...props}
                    />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th
                    style={{
                      border: "1px solid #ccc",
                      padding: "0.5em",
                      textAlign: "left",
                    }}
                    {...props}
                  />
                ),
                td: ({ node, ...props }) => (
                  <td
                    style={{ border: "1px solid #ccc", padding: "0.5em" }}
                    {...props}
                  />
                ),
                pre: ({ node, ...props }) => (
                  <pre
                    style={{
                      background: "#f6f8fa",
                      padding: "1em",
                      margin: "1em 0",
                      borderRadius: "4px",
                      overflowX: "auto",
                    }}
                    {...props}
                  />
                ),
                code: ({ node, inline, className, children, ...rest }: any) =>
                  inline ? (
                    <code
                      style={{
                        background: "#f6f8fa",
                        padding: "0.2em 0.4em",
                        borderRadius: "4px",
                        fontSize: "0.95em",
                      }}
                      className={className}
                      {...rest}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...rest}>
                      {children}
                    </code>
                  ),
              }}
            >
              {article.summary}
            </ReactMarkdown>
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
            disabled={favLoading}
            style={{
              background: "none",
              border: "none",
              position: "absolute",
              top: "8px",
              right: "8px",
              cursor: favLoading ? "default" : "pointer",
            }}
          >
            {favLoading ? (
              <div className="fav-spinner" />
            ) : isFavorited ? (
              <MdFavorite size={20} color="#e74c3c" />
            ) : (
              <MdFavoriteBorder size={20} />
            )}
          </button>
        )}
      </div>

      {/* Spinner styles */}
      <style jsx>{`
        .fav-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #ccc;
          border-top-color: #333;
          border-radius: 50%;
          animation: fav-spin 0.6s linear infinite;
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
