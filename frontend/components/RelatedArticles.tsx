import React, { useState, useEffect } from "react";
import Slider from "react-slick";
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
        <h2 className="related-articles-title">Related Articles</h2>
        <div className="loading-state">
          <div className="spinner" />
          <p>Finding similar articles...</p>
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
        <h2 className="related-articles-title">Related Articles</h2>
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

      <style jsx global>{`
        .related-articles-section {
          margin: 2.5rem 0;
          padding: 0;
        }

        .related-articles-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: var(--text-color);
        }

        .carousel-wrapper {
          margin: 0 -0.5rem;
        }

        .carousel-slide {
          padding: 0 0.5rem;
          outline: none;
        }

        /* Related Card - Fixed dimensions */
        .related-card {
          background-color: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 6px;
          padding: 1rem;
          height: 320px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .related-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .related-card-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.75rem 0;
          color: var(--text-color);
          line-height: 1.4;
          height: 3em;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .related-card-summary {
          flex: 1;
          margin: 0.5rem 0;
          overflow: hidden;
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
          margin: 0.75rem 0;
          min-height: 28px;
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
          margin-top: auto;
          padding-top: 0.5rem;
          color: var(--accent-color);
          font-size: 0.9rem;
          font-weight: 500;
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
          width: 40px;
          height: 40px;
          z-index: 10;
        }

        .related-articles-section :global(.slick-prev) {
          left: -45px;
        }

        .related-articles-section :global(.slick-next) {
          right: -45px;
        }

        .related-articles-section :global(.slick-prev:before),
        .related-articles-section :global(.slick-next:before) {
          font-size: 40px;
          color: var(--accent-color);
          opacity: 0.8;
        }

        .related-articles-section :global(.slick-prev:hover:before),
        .related-articles-section :global(.slick-next:hover:before) {
          opacity: 1;
        }

        /* Carousel Dots */
        .related-articles-section :global(.slick-dots) {
          bottom: -40px;
        }

        .related-articles-section :global(.slick-dots li button:before) {
          font-size: 10px;
          color: var(--accent-color);
          opacity: 0.5;
        }

        .related-articles-section :global(.slick-dots li.slick-active button:before) {
          opacity: 1;
        }

        /* Mobile adjustments */
        @media (max-width: 1024px) {
          .related-articles-section :global(.slick-prev) {
            left: -30px;
          }

          .related-articles-section :global(.slick-next) {
            right: -30px;
          }
        }

        @media (max-width: 640px) {
          .related-card {
            height: auto;
            min-height: 280px;
          }

          .related-articles-section :global(.slick-prev) {
            left: -10px;
          }

          .related-articles-section :global(.slick-next) {
            right: -10px;
          }

          .related-articles-section :global(.slick-prev),
          .related-articles-section :global(.slick-next) {
            width: 30px;
            height: 30px;
          }

          .related-articles-section :global(.slick-prev:before),
          .related-articles-section :global(.slick-next:before) {
            font-size: 30px;
          }
        }
      `}</style>
    </>
  );
}
