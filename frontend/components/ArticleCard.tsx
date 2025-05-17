import React, { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  MdOutlineArrowForwardIos,
  MdFavorite,
  MdFavoriteBorder,
} from "react-icons/md";
import { Article } from "../pages";
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);

    (async () => {
      try {
        const favorites = await fetchFavoriteArticleIds(token);
        setIsFavorited(favorites.includes(article._id));
      } catch (error) {
        console.error("Error loading favorites", error);
      }
    })();
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
              remarkPlugins={[remarkGfm, remarkMath]}
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
    </>
  );
}
