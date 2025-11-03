import React, { useState, useEffect } from "react";
import Slider from "react-slick";
import { Article } from "../pages/home";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import ArticleCard from "./ArticleCard";
import { MdFavorite, MdFavoriteBorder } from "react-icons/md";
import {
  fetchFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../services/api";
import { toast } from "react-toastify";

interface ArticleCarouselProps {
  articles: Article[];
  autoRotateInterval?: number;
  direction?: "left" | "right";
  initialIndex?: number;
}

// Cache for favorite article IDs
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
  const fetched = await fetchFavoriteArticleIds(token);
  cachedFavIds = fetched;
  localStorage.setItem("favIds", JSON.stringify(fetched));
  return fetched;
}

export default function ArticleCarousel({
  articles,
  autoRotateInterval = 3000,
  direction = "left",
  initialIndex,
}: ArticleCarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favLoading, setFavLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);

    loadFavCache(token)
      .then((ids) => {
        setFavoriteIds(new Set(ids));
      })
      .catch((err) => {
        console.error("Error loading favorites", err);
      });

    // Listen for cache updates from other components
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.favIds) {
        cachedFavIds = customEvent.detail.favIds;
        setFavoriteIds(new Set(customEvent.detail.favIds));
      }
    };

    window.addEventListener("favCacheUpdated", handleCustomEvent);

    return () => {
      window.removeEventListener("favCacheUpdated", handleCustomEvent);
    };
  }, []);

  const truncateSummary = (text: string, maxLength: number = 250) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const handleTopicClick = (e: React.MouseEvent, topic: string) => {
    e.stopPropagation();
    if (!isDragging) {
      window.location.href = `/home?topic=${encodeURIComponent(topic)}`;
    }
  };

  const handleCardMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  };

  const handleCardMouseMove = (e: React.MouseEvent) => {
    const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
    if (deltaX > 5 || deltaY > 5) {
      setIsDragging(true);
    }
  };

  const handleCardMouseUp = () => {
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleCardClick = (e: React.MouseEvent, articleId: string) => {
    e.preventDefault();
    if (!isDragging) {
      window.location.href = `/articles/${articleId}`;
    }
  };

  const handleFavorite = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) return;

    const wasFavorited = favoriteIds.has(articleId);
    setFavLoading(articleId);
    try {
      await toggleFavoriteArticle(token, articleId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(articleId)) {
          next.delete(articleId);
        } else {
          next.add(articleId);
        }

        // Update cache
        if (cachedFavIds) {
          if (next.has(articleId)) {
            if (!cachedFavIds.includes(articleId)) {
              cachedFavIds.push(articleId);
            }
          } else {
            cachedFavIds = cachedFavIds.filter((id) => id !== articleId);
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
      setFavLoading(null);
    }
  };

  const getVisibleTopics = (topics: string[]) => {
    if (!topics || topics.length === 0) return [];
    const maxTopics = 2;
    return topics.slice(0, maxTopics);
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  const sliderSettings = {
    dots: true,
    infinite: articles.length > 3,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: autoRotateInterval,
    pauseOnHover: true,
    rtl: direction === "right",
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          rtl: direction === "right",
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          rtl: direction === "right",
        },
      },
    ],
  };

  return (
    <>
      {/* Mobile: Regular grid */}
      <div className="mobile-grid">
        {articles.map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>

      {/* Desktop/Tablet: Slider Carousel */}
      <div className="article-carousel-section">
        <div className="carousel-wrapper">
          <Slider {...sliderSettings}>
            {articles.map((article) => (
              <div key={article._id} className="carousel-slide">
                <div
                  className="carousel-card"
                  onMouseDown={handleCardMouseDown}
                  onMouseMove={handleCardMouseMove}
                  onMouseUp={handleCardMouseUp}
                  onClick={(e) => handleCardClick(e, article._id)}
                  style={{ position: "relative" }}
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
                          className="carousel-topic-badge carousel-topic-badge-clickable"
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

                  <div className="carousel-card-footer">
                    <div className="carousel-card-readmore">Read More →</div>

                    {isLoggedIn && (
                      <button
                        className="carousel-favorite-btn"
                        onClick={(e) => handleFavorite(e, article._id)}
                        aria-label="Favorite Article"
                        disabled={favLoading === article._id}
                        style={{ position: "static" }}
                      >
                        {favLoading === article._id ? (
                          <div className="carousel-fav-spinner" />
                        ) : favoriteIds.has(article._id) ? (
                          <MdFavorite size={20} color="#e74c3c" />
                        ) : (
                          <MdFavoriteBorder
                            size={20}
                            className="carousel-fav-icon-outline"
                          />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>

      <style>{`
        .carousel-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--card-border);
        }
        
        .carousel-favorite-btn {
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s ease;
          border-radius: 8px;
          padding: 0;
        }
        
        .carousel-favorite-btn:disabled {
          cursor: default;
        }
        
        .carousel-favorite-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }
        
        .carousel-fav-icon-outline {
          color: var(--text-color);
          opacity: 0.7;
        }
        
        [data-theme="dark"] .carousel-fav-icon-outline {
          color: #ffffff;
          opacity: 0.9;
        }
        
        .carousel-fav-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #ccc;
          border-top-color: #333;
          border-radius: 50%;
          animation: carousel-fav-spin 0.6s linear infinite;
        }
        
        [data-theme="dark"] .carousel-fav-spinner {
          border-color: #555;
          border-top-color: #fff;
        }
        
        @keyframes carousel-fav-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
