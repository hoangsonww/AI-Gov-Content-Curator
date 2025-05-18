import React, { useState, useEffect } from "react";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";
import { useRouter } from "next/router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  fetchFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../services/api";
import { Article } from "../pages/home";
import { toast } from "react-toastify";

interface ArticleDetailProps {
  article: Article;
}

export default function ArticleDetail({ article }: ArticleDetailProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);

    (async () => {
      try {
        const favorites = await fetchFavoriteArticleIds(token);
        setIsFavorited(favorites.includes(article._id));
      } catch (error) {
        console.error("Error loading favorites", error);
        toast.error("Failed to load favorite status");
      } finally {
        setLoading(false);
      }
    })();
  }, [article._id]);

  const handleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      await toggleFavoriteArticle(token, article._id);
      setIsFavorited((prev) => !prev);
      toast(`Article ${isFavorited ? "unfavorited 💔" : "favorited ❤️"}`);
    } catch (error) {
      console.error("Error toggling favorite", error);
      toast.error("Error toggling favorite");
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topic: string) => {
    router.push(`/home?topic=${encodeURIComponent(topic)}`);
  };

  const title = article.title?.trim() || "Article Title Unavailable";

  return (
    <div
      className="article-detail hover-animate"
      style={{ position: "relative" }}
    >
      <h1 className="detail-title">{title}</h1>
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
      <div className="detail-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ node, ...props }) => (
              <p style={{ margin: 0, lineHeight: "1.5" }} {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul
                style={{
                  paddingLeft: "1.5em",
                  margin: 0,
                  listStylePosition: "inside",
                  lineHeight: "1.4",
                }}
                {...props}
              />
            ),
            ol: ({ node, ...props }) => (
              <ol
                style={{
                  paddingLeft: "1.5em",
                  margin: 0,
                  listStylePosition: "inside",
                  lineHeight: "1.4",
                }}
                {...props}
              />
            ),
            li: ({ node, ...props }) => (
              <li style={{ margin: 0, lineHeight: "1.4" }} {...props} />
            ),
            table: ({ node, ...props }) => (
              <div style={{ overflowX: "auto" }}>
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
                  margin: 0,
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
                    lineHeight: "1.4",
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
      {article.topics?.length > 0 && (
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
          disabled={loading}
          style={{
            background: "none",
            border: "none",
            position: "absolute",
            top: "8px",
            right: "8px",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? (
            <div className="fav-spinner" />
          ) : isFavorited ? (
            <MdFavorite size={20} color="#e74c3c" />
          ) : (
            <MdFavoriteBorder size={20} />
          )}
        </button>
      )}

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
    </div>
  );
}
