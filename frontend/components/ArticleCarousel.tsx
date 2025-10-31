import React, { useState, useEffect, useRef } from "react";
import { Article } from "../pages/home";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import ArticleCard from "./ArticleCard";

interface ArticleCarouselProps {
  articles: Article[];
  autoRotateInterval?: number;
  direction?: "left" | "right";
  initialIndex?: number;
}

export default function ArticleCarousel({
  articles,
  autoRotateInterval = 3000,
  direction = "left",
  initialIndex,
}: ArticleCarouselProps) {
  const itemsPerView = 3;
  const maxIndex = Math.max(0, articles.length - itemsPerView);

  const startIndex = React.useMemo(() => {
    if (initialIndex !== undefined) {
      return Math.min(initialIndex, maxIndex);
    }
    return direction === "right" ? maxIndex : 0;
  }, [initialIndex, maxIndex, direction]);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isHovered, setIsHovered] = useState(false);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    if (!isHovered && articles.length > itemsPerView) {
      autoRotateRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (direction === "left") {
            return prev >= maxIndex ? 0 : prev + 1;
          } else {
            return prev <= 0 ? maxIndex : prev - 1;
          }
        });
      }, autoRotateInterval);
    }

    return () => {
      if (autoRotateRef.current) {
        clearInterval(autoRotateRef.current);
      }
    };
  }, [
    isHovered,
    articles.length,
    autoRotateInterval,
    direction,
    maxIndex,
    itemsPerView,
  ]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const truncateSummary = (text: string, maxLength: number = 250) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const handleTopicClick = (e: React.MouseEvent, topic: string) => {
    e.stopPropagation();
    window.location.href = `/home?topic=${encodeURIComponent(topic)}`;
  };

  const getVisibleTopics = (topics: string[]) => {
    if (!topics || topics.length === 0) return [];
    const maxTopics = 2;
    return topics.slice(0, maxTopics);
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <>
      {/* Mobile: Regular grid */}
      <div className="mobile-grid">
        {articles.map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>

      {/* Desktop/Tablet: Carousel */}
      <div
        className="carousel-container"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          className="carousel-btn carousel-btn-prev"
          onClick={goToPrevious}
          aria-label="Previous"
        >
          ‹
        </button>

        <div className="carousel-track-container">
          <div
            className="carousel-track"
            style={{
              transform: `translateX(-${currentIndex * (100 / itemsPerView)}%)`,
            }}
          >
            {articles.map((article) => (
              <div key={article._id} className="carousel-slide">
                <div
                  className="carousel-card"
                  onClick={() =>
                    (window.location.href = `/articles/${article._id}`)
                  }
                >
                  <h3 className="carousel-card-title">{article.title}</h3>

                  {article.summary && (
                    <div className="carousel-card-summary">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {truncateSummary(article.summary)}
                      </ReactMarkdown>
                    </div>
                  )}

                  {article.topics && article.topics.length > 0 && (
                    <div className="carousel-card-topics">
                      {getVisibleTopics(article.topics).map((topic, idx) => (
                        <span
                          key={idx}
                          className="carousel-topic-badge"
                          onClick={(e) => handleTopicClick(e, topic)}
                        >
                          {topic}
                        </span>
                      ))}
                      {article.topics.length > 2 && (
                        <span className="carousel-topic-badge carousel-topic-more">
                          +{article.topics.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="carousel-card-readmore">Read More →</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="carousel-btn carousel-btn-next"
          onClick={goToNext}
          aria-label="Next"
        >
          ›
        </button>

        <div className="carousel-indicators">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              className={`indicator ${idx === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <style>{`
        .mobile-grid {
          display: none;
        }

        .carousel-container {
          position: relative;
          width: 100%;
          margin: 2rem 0;
          display: block;
        }

        .carousel-track-container {
          overflow: hidden;
          width: 100%;
        }

        .carousel-track {
          display: flex;
          transition: transform 0.5s ease-in-out;
        }

        .carousel-slide {
          min-width: calc(100% / 3);
          padding: 0 0.5rem;
          box-sizing: border-box;
          outline: none;
          overflow: hidden;
        }

        .carousel-card {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 1rem;
          height: 450px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
          overflow: hidden;
        }

        .carousel-card:hover {
          border-color: var(--accent-color);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }

        .carousel-card-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
          color: var(--text-color);
          line-height: 1.4;
          max-height: 3em;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
          word-wrap: break-word;
          word-break: break-word;
          flex-shrink: 0;
        }

        .carousel-card-summary {
          flex: 1 1 auto;
          margin: 0 0 0.75rem 0;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
          min-height: 0;
        }

        .carousel-card-summary p {
          font-size: 0.9rem;
          color: var(--text-color);
          opacity: 0.8;
          line-height: 1.5;
          margin: 0;
        }

        .carousel-card-summary ul,
        .carousel-card-summary ol {
          padding-left: 1.2em;
          margin: 0.3em 0;
          font-size: 0.9rem;
        }

        .carousel-card-summary li {
          margin: 0.2em 0;
        }

        .carousel-card-summary code {
          background: var(--card-border);
          padding: 0.1em 0.3em;
          border-radius: 3px;
          font-size: 0.85em;
        }

        .carousel-card-summary strong {
          font-weight: 600;
        }

        .carousel-card-topics {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin: 0;
          margin-top: auto;
          padding-top: 0.5rem;
          overflow: hidden;
          flex-shrink: 0;
          max-height: 32px;
        }

        .carousel-topic-badge {
          background: var(--accent-color);
          color: white;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          flex-shrink: 0;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .carousel-topic-more {
          cursor: default;
          opacity: 0.8;
        }

        .carousel-topic-badge:hover {
          background: var(--navbar-text);
          opacity: 1;
        }

        .carousel-topic-more:hover {
          background: var(--accent-color);
          opacity: 0.8;
        }

        .dark .carousel-topic-badge {
          background: var(--accent-color);
          opacity: 0.9;
        }

        .carousel-card-readmore {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--card-border);
          color: var(--accent-color);
          font-size: 0.9rem;
          font-weight: 500;
          flex-shrink: 0;
        }

        .carousel-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 3rem;
          color: var(--text-color);
          cursor: pointer;
          z-index: 10;
          padding: 0.5rem 1rem;
          transition: opacity 0.3s ease;
          opacity: 0.6;
          user-select: none;
        }

        .carousel-btn:hover {
          opacity: 1;
        }

        .carousel-btn-prev {
          left: -2.5rem;
        }

        .carousel-btn-next {
          right: -2.5rem;
        }

        .carousel-indicators {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid var(--accent-color);
          background: transparent;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }

        .indicator.active {
          background: var(--accent-color);
          transform: scale(1.2);
        }

        @media (max-width: 1024px) {
          .carousel-slide {
            min-width: calc(100% / 2);
          }

          .carousel-btn-prev {
            left: -1.5rem;
          }

          .carousel-btn-next {
            right: -1.5rem;
          }
        }

        @media (max-width: 768px) {
          .mobile-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1rem;
          }

          .carousel-container {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
