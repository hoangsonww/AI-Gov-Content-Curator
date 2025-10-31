import React, { useState, useEffect } from "react";
import Slider from "react-slick";
import { MdArticle } from "react-icons/md";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { BASE_URL } from "../services/api";

interface SimilarArticle {
  _id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  topics: string[];
  fetchedAt: string;
  score?: number;
}

interface RelatedArticlesProps {
  articleId: string;
}

export default function RelatedArticles({ articleId }: RelatedArticlesProps) {
  const [articles, setArticles] = useState<SimilarArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimilarArticles = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `${BASE_URL}/articles/${articleId}/similar?limit=6`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch similar articles");
        }

        const data = await response.json();
        const mappedArticles = (data.data || []).map((article: any) => ({
          _id: article.id,
          url: article.url || "",
          title: article.title,
          summary: article.summary,
          source: article.source,
          topics: article.topics || [],
          fetchedAt: article.fetchedAt,
        }));
        setArticles(mappedArticles);
      } catch (err: any) {
        console.error("Error fetching similar articles:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (articleId) {
      fetchSimilarArticles();
    }
  }, [articleId]);

  const truncateSummary = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  if (loading) {
    return (
      <div className="related-articles-section">
        <div className="loading-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-title"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-text short"></div>
              <div className="skeleton-badges">
                <div className="skeleton-badge"></div>
                <div className="skeleton-badge"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !articles.length) {
    return null;
  }

  const sliderSettings = {
    dots: true,
    infinite: articles.length > 3,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  return (
    <>
      <div className="related-articles-section">
        <h2 className="related-articles-title">
          <MdArticle className="title-icon" />
          Related Articles
        </h2>
        <div className="carousel-wrapper">
          <Slider {...sliderSettings}>
            {articles.map((article) => (
              <div key={article._id} className="carousel-slide">
                <div
                  className="related-card"
                  onClick={() => (window.location.href = `/articles/${article._id}`)}
                >
                  <h3 className="related-card-title">{article.title}</h3>

                  {article.summary && (
                    <div className="related-card-summary">
                      <p>{truncateSummary(article.summary)}</p>
                    </div>
                  )}

                  {article.topics && article.topics.length > 0 && (
                    <div className="related-card-topics">
                      {article.topics.slice(0, 3).map((topic, idx) => (
                        <span key={idx} className="related-topic-badge">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="related-card-readmore">
                    Read More →
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>

      <style>{`
        .related-articles-section {
          margin: 2.5rem 0;
          padding: 0;
          padding-top: 15px;
          padding-bottom: 2rem;
        }

        .related-articles-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: var(--text-color);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .title-icon {
          font-size: 1.75rem;
          color: var(--accent-color);
        }

        .carousel-wrapper {
          margin: 0 -0.5rem;
          padding-top: 10px;
        }

        .carousel-slide {
          padding: 0 0.5rem;
          outline: none;
          overflow: hidden;
        }

        /* Related Card - Fixed dimensions */
        .related-card {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 1rem;
          height: 380px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
          overflow: hidden;
        }

        .related-card:hover {
          border-color: var(--accent-color);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }

        .related-card-title {
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
        }

        .related-card-summary {
          flex: 1;
          margin: 0 0 0.75rem 0;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          text-overflow: ellipsis;
        }

        .related-card-summary p {
          font-size: 0.9rem;
          color: var(--text-color);
          opacity: 0.8;
          line-height: 1.5;
          margin: 0;
        }

        .related-card-topics {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin: 0;
          margin-top: auto;
          padding-top: 0.5rem;
          min-height: 32px;
          max-height: 64px;
          overflow: hidden;
        }

        .related-topic-badge {
          background: var(--accent-color);
          color: white;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .dark .related-topic-badge {
          background: var(--accent-color);
          opacity: 0.9;
        }

        .related-card-readmore {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--card-border);
          color: var(--accent-color);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .loading-skeleton {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin: 0 -0.5rem;
        }

        .skeleton-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 1rem;
          height: 380px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .skeleton-title {
          height: 2.5rem;
          background: linear-gradient(90deg, var(--card-border) 25%, rgba(128, 128, 128, 0.1) 50%, var(--card-border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        .skeleton-text {
          height: 1rem;
          background: linear-gradient(90deg, var(--card-border) 25%, rgba(128, 128, 128, 0.1) 50%, var(--card-border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        .skeleton-text.short {
          width: 70%;
        }

        .skeleton-badges {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
        }

        .skeleton-badge {
          width: 60px;
          height: 24px;
          background: linear-gradient(90deg, var(--card-border) 25%, rgba(128, 128, 128, 0.1) 50%, var(--card-border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 0;
        }

        .loading-state p {
          color: var(--text-color);
          opacity: 0.7;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--card-border);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Carousel Navigation Arrows */
        .related-articles-section :global(.slick-prev),
        .related-articles-section :global(.slick-next) {
          width: 48px;
          height: 48px;
          z-index: 10;
          background: var(--card-bg);
          border: 2px solid var(--accent-color);
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: background 0.3s ease, box-shadow 0.3s ease;
          transform: none !important;
        }

        .related-articles-section :global(.slick-prev:hover),
        .related-articles-section :global(.slick-next:hover) {
          background: var(--accent-color);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          transform: none !important;
        }

        .related-articles-section :global(.slick-prev) {
          left: -55px;
        }

        .related-articles-section :global(.slick-next) {
          right: -55px;
        }

        .related-articles-section :global(.slick-prev:before),
        .related-articles-section :global(.slick-next:before) {
          font-size: 20px;
          color: var(--accent-color);
          opacity: 1;
          font-weight: bold;
        }

        .related-articles-section :global(.slick-prev:hover:before),
        .related-articles-section :global(.slick-next:hover:before) {
          color: white;
        }

        .related-articles-section :global(.slick-disabled) {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .related-articles-section :global(.slick-disabled:hover) {
          background: var(--card-bg);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        /* Carousel Dots */
        .related-articles-section :global(.slick-dots) {
          bottom: -45px;
          display: flex !important;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 0;
          margin: 0;
          list-style: none;
        }

        .related-articles-section :global(.slick-dots li) {
          width: auto;
          height: auto;
          margin: 0;
        }

        .related-articles-section :global(.slick-dots li button) {
          width: 12px;
          height: 12px;
          padding: 0;
          background: var(--card-border);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .related-articles-section :global(.slick-dots li button:before) {
          content: '';
          display: none;
        }

        .related-articles-section :global(.slick-dots li button:hover) {
          background: var(--accent-color);
          opacity: 0.7;
          transform: scale(1.2);
        }

        .related-articles-section :global(.slick-dots li.slick-active button) {
          width: 32px;
          border-radius: 6px;
          background: var(--accent-color);
          opacity: 1;
        }

        .related-articles-section :global(.slick-dots li.slick-active button:hover) {
          transform: scale(1.05);
        }

        /* Mobile adjustments */
        @media (max-width: 1024px) {
          .loading-skeleton {
            grid-template-columns: repeat(2, 1fr);
          }

          .related-articles-section :global(.slick-prev) {
            left: -40px;
          }

          .related-articles-section :global(.slick-next) {
            right: -40px;
          }

          .related-articles-section :global(.slick-prev),
          .related-articles-section :global(.slick-next) {
            width: 40px;
            height: 40px;
          }
        }

        @media (max-width: 640px) {
          .loading-skeleton {
            grid-template-columns: 1fr;
          }

          .skeleton-card {
            height: auto;
            min-height: 320px;
          }

          .related-card {
            height: auto;
            min-height: 320px;
          }

          .related-card-summary {
            -webkit-line-clamp: 3;
          }

          .related-articles-section :global(.slick-prev) {
            left: 5px;
          }

          .related-articles-section :global(.slick-next) {
            right: 5px;
          }

          .related-articles-section :global(.slick-prev),
          .related-articles-section :global(.slick-next) {
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(4px);
          }

          .related-articles-section :global(.slick-prev:before),
          .related-articles-section :global(.slick-next:before) {
            font-size: 18px;
          }

          .related-articles-section :global(.slick-dots) {
            bottom: -35px;
          }

          .related-articles-section :global(.slick-dots li button) {
            width: 8px;
            height: 8px;
          }

          .related-articles-section :global(.slick-dots li.slick-active button) {
            width: 24px;
          }
        }
      `}</style>
    </>
  );
}
