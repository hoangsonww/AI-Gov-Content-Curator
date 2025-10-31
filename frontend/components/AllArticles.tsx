import React, { useEffect, useState } from "react";
import { Article } from "../pages/home";
import ArticleCarousel from "./ArticleCarousel";
import { getArticles, getTotalArticles } from "../services/api";
import { MdExpandMore } from "react-icons/md";

export default function AllArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(3);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalArticles, setTotalArticles] = useState<number | null>(null);

  useEffect(() => {
    fetchArticles(page);
    fetchTotalArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchArticles = async (pageToLoad: number) => {
    try {
      setLoading(true);
      const data = await getArticles(pageToLoad, 10);
      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        setArticles((prev) => [...prev, ...data]);
      }
    } catch (error) {
      console.error("Error fetching all articles:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalArticles = async () => {
    const total = await getTotalArticles();
    console.log(total);
    setTotalArticles(total);
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchArticles(nextPage);
  };

  const splitIntoCarousels = (items: Article[]) => {
    const carousels: Article[][] = [];
    const itemsPerCarousel = 6;

    for (let i = 0; i < items.length; i += itemsPerCarousel) {
      carousels.push(items.slice(i, i + itemsPerCarousel));
    }

    return carousels;
  };

  const carouselGroups = splitIntoCarousels(articles);

  return (
    <div className="all-articles-section">
      <h1
        className="page-title"
        style={{ fontSize: "2rem", textAlign: "center" }}
      >
        All Articles 📚
      </h1>
      <p
        className="subtitle fade-down"
        style={{ textAlign: "center", marginBottom: "1.5rem" }}
      >
        Browse everything we've collected, summarized, and saved for you.
      </p>

      <div className="all-articles-carousels">
        {carouselGroups.map((group, index) => (
          <ArticleCarousel
            key={`carousel-${index}`}
            articles={group}
            autoRotateInterval={3000}
            direction={index % 2 === 0 ? "left" : "right"}
          />
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div className="spinner" />
        </div>
      )}

      {hasMore && !loading && (
        <button className="load-more-btn" onClick={handleLoadMore}>
          Load More <MdExpandMore size={20} />
        </button>
      )}

      {!hasMore && articles.length > 0 && (
        <p className="fade-down" style={{ textAlign: "center" }}>
          No more articles to load. More articles coming soon! 🚀
        </p>
      )}

      {totalArticles !== null && articles.length > 0 && (
        <p
          style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem" }}
        >
          Displaying Articles{" "}
          <strong>
            {articles.length > 0 ? `1 - ${articles.length}` : "0"}
          </strong>{" "}
          of <strong>{totalArticles}</strong>
        </p>
      )}

      <style>{`
        .all-articles-section {
          margin-top: 2rem;
        }

        .all-articles-carousels {
          margin-bottom: 2rem;
        }

        .load-more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin: 2rem auto;
          padding: 0.75rem 2rem;
          background: var(--accent-color);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .load-more-btn:hover {
          background: color-mix(in srgb, var(--accent-color) 80%, black);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .load-more-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
