import { useEffect, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { Article } from "../index";
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
        <title>Article Curator - My Favorite Articles</title>
      </Head>
      <div className="favorites-container">
        <h1 className="favorites-title">My Favorite Articles</h1>

        {loading ? (
          <p className="loading-msg">Loading favorites...</p>
        ) : !isLoggedIn ? (
          <div className="not-logged-in">
            <p style={{ textAlign: "center" }}>
              Please <Link href="/auth/login">sign in</Link> to view your
              favorite articles.
            </p>
          </div>
        ) : favoriteArticles.length === 0 ? (
          <p className="no-favorites">
            You have not favorited any articles yet.
          </p>
        ) : (
          <div className="article-grid">
            {favoriteArticles.map((article) => (
              <ArticleCard key={article._id} article={article} />
            ))}
          </div>
        )}

        <div className="back-home-container">
          <Link href="/" className="back-home-link">
            Back to Home
          </Link>
        </div>
      </div>
    </>
  );
}
