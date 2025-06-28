import { useEffect, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { Article } from "../home";
import ArticleCard from "../../components/ArticleCard";
import { fetchFavoriteArticles } from "../../services/api";

export default function FavoritesPage() {
  const [favoriteArticles, setFavoriteArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setFavoriteArticles([]);
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);

    const fetchFavorites = async () => {
      try {
        const data = await fetchFavoriteArticles(token);
        setFavoriteArticles(data);
      } catch (error) {
        console.error(
          error instanceof Error ? error.message : "An error occurred.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  return (
    <>
      <Head>
        <title>SynthoraAI - My Favorite Articles</title>
      </Head>

      <div className="favorites-container">
        <h1 className="favorites-title">My Favorite Articles ⭐️</h1>

        {loading && (
          <div className="loading-indicator" aria-label="Loading favorites" />
        )}

        {!loading && !isLoggedIn && (
          <div className="not-logged-in">
            <p style={{ textAlign: "center" }}>
              Please <Link href="/auth/login">sign in</Link> to view your
              favorite articles.
            </p>
          </div>
        )}

        {!loading && isLoggedIn && favoriteArticles.length === 0 && (
          <p className="no-favorites">
            You have not favorited any articles yet.
          </p>
        )}

        {!loading && isLoggedIn && favoriteArticles.length > 0 && (
          <>
            <p
              className="subtitle fade-down"
              style={{ textAlign: "center", marginBottom: "1.5rem" }}
            >
              Here are all the articles you’ve favorited.
            </p>

            <div className="article-grid">
              {favoriteArticles.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          </>
        )}

        <div className="back-home-container">
          <Link href="/home" className="back-home-link">
            Back to Home
          </Link>
        </div>
      </div>

      <style jsx>{`
        .loading-indicator {
          width: 32px;
          height: 32px;
          margin: 1.5rem auto;
          border: 4px solid #e0e0e0;
          border-top-color: #333;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
