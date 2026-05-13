import React, { useState, useEffect } from "react";
import { Article } from "../pages/home";
import ArticleCarousel from "./ArticleCarousel";
import { rerankArticles, getTopTopics, updatePreferences, saveUserProfile } from "../services/reranker";
import { getUserPreferences } from "../services/api";

interface RecommendedArticlesProps {
  allArticles: Article[];
}

export default function RecommendedArticles({
  allArticles,
}: RecommendedArticlesProps) {
  const [recommendedArticles, setRecommendedArticles] = useState<Article[]>([]);
  const [topTopics, setTopTopics] = useState<string[]>([]);
  const [hasInteractions, setHasInteractions] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);

  useEffect(() => {
    // Get user's top topics
    const userTopics = getTopTopics(5);
    setTopTopics(userTopics);

    // Check if user has any interaction history
    const profile = localStorage.getItem("user_profile");
    let hasHistory = false;
    let parsed = null
    if (profile) {
      try {
        parsed = JSON.parse(profile);
        hasHistory =
          parsed.interactionHistory && parsed.interactionHistory.length > 0;
      } catch (e) {
        hasHistory = false;
      }
    }
    setHasInteractions(hasHistory);
    if (hasHistory && parsed) {
      // Update preferences based on current articles
      const new_profile = updatePreferences(parsed, allArticles);
      saveUserProfile(new_profile);
    }

    // Show recommendations for everyone (personalized or popular)
    if (allArticles && allArticles.length > 0) {
      if (hasHistory && userTopics.length > 0) {
        // Personalized recommendations
        const ranked = rerankArticles(allArticles);
        setRecommendedArticles(ranked.slice(0, 6));
      } else {
        // For new users, show most recent articles
        setRecommendedArticles(allArticles.slice(0, 6));
      }
    }

  // --- PART 2: ASYNC LOGIC (RUNS IN BACKGROUND) ---
  // Get user preferences from onboarding quiz and use it 
  // to filter articles based on source and topic
  const loadPreferencesAndFilter = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || hasHistory) return; // Only need preferences for new users

      const prefsResult = await getUserPreferences(token);
      console.log("Recommendation preferences:", prefsResult)
      if (prefsResult && allArticles?.length > 0) {
        setTopTopics(prefsResult.topics);
        setHasPreferences(true);
        const currentTopics = new Set(prefsResult.topics || []);
        const currentSources = new Set(prefsResult.sources || []);
        console.log("Recommendation topics:", currentTopics)
        console.log("Recommendation sources:", currentSources)
        // RE-FILTER now that we have prefs
        const filtered = allArticles.filter(article => 
          article.topics?.some(t => currentTopics.has(t)) || 
          currentSources.has(article.source)
        );

        if (filtered.length > 0) {
          setRecommendedArticles(filtered.slice(0, 6));
        }
      }
    } catch (err) {
      console.error('Error refining recommendations:', err);
    }
  };

  loadPreferencesAndFilter();

  }, [allArticles]);

  // Don't show if no articles
  if (recommendedArticles.length === 0) {
    return null;
  }

  return (
    <div className="recommended-articles-section">
      <div className="recommended-header">
        <h2 className="recommended-title">
          {(hasInteractions || hasPreferences) ? (
            <>
              Recommended For You <span className="title-emoji">🎯</span>
            </>
          ) : (
            <>
              Trending Articles <span className="title-emoji">🔥</span>
            </>
          )}
        </h2>
        {topTopics.length > 0 ? (
          <p className="recommended-subtitle">
            Based on your interest in{" "}
            <span className="topic-highlight">
              {topTopics.slice(0, 3).join(", ")}
            </span>
          </p>
        ) : (
          <p className="recommended-subtitle">
            Popular articles you might enjoy
          </p>
        )}
      </div>

      <ArticleCarousel
        articles={recommendedArticles}
        autoRotateInterval={3000}
        direction="left"
      />

      <style>{`
        .recommended-articles-section {
          margin: 2rem 0 3rem 0;
          padding: 1.5rem;
          background: linear-gradient(135deg, 
            var(--card-bg) 0%, 
            var(--hover-bg) 100%
          );
          border: 1px solid var(--accent-color);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .recommended-header {
          text-align: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--accent-color);
        }

        .recommended-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--text-color);
          margin: 0 0 0.5rem 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .title-emoji {
          font-size: 1.6rem;
        }

        .recommended-subtitle {
          font-size: 0.95rem;
          color: var(--text-color);
          opacity: 0.8;
          margin: 0;
        }

        .topic-highlight {
          color: var(--accent-color);
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .recommended-articles-section {
            padding: 1rem;
            margin: 1.5rem 0 2rem 0;
          }

          .recommended-title {
            font-size: 1.5rem;
          }

          .recommended-subtitle {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}
