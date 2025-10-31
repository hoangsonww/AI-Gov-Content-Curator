/**
 * Client-side feed re-ranker
 * Personalizes article feed based on user interactions stored in localStorage
 */

import { Article } from "../pages/home";

interface UserInteraction {
  articleId: string;
  action: "view" | "favorite" | "rate" | "click_topic";
  timestamp: number;
  rating?: number;
  topic?: string;
}

interface UserProfile {
  topicPreferences: Record<string, number>; // topic -> score
  sourcePreferences: Record<string, number>; // source -> score
  interactionHistory: UserInteraction[];
  lastUpdated: number;
}

const STORAGE_KEY = "user_profile";
const MAX_HISTORY = 100;

// Scoring weights
const WEIGHTS = {
  favorite: 3.0,
  highRating: 2.5, // rating >= 4
  mediumRating: 1.5, // rating 3
  view: 1.0,
  topicClick: 2.0,
  recency: 0.5, // decay factor
};

/**
 * Get user profile from localStorage
 */
function getUserProfile(): UserProfile {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse user profile", e);
    }
  }

  return {
    topicPreferences: {},
    sourcePreferences: {},
    interactionHistory: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Save user profile to localStorage
 */
function saveUserProfile(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save user profile", e);
  }
}

/**
 * Track user interaction
 */
export function trackInteraction(
  articleId: string,
  action: UserInteraction["action"],
  metadata?: { rating?: number; topic?: string }
) {
  const profile = getUserProfile();

  const interaction: UserInteraction = {
    articleId,
    action,
    timestamp: Date.now(),
    ...metadata,
  };

  profile.interactionHistory.push(interaction);

  // Keep only recent interactions
  if (profile.interactionHistory.length > MAX_HISTORY) {
    profile.interactionHistory = profile.interactionHistory.slice(-MAX_HISTORY);
  }

  profile.lastUpdated = Date.now();
  saveUserProfile(profile);
}

/**
 * Update user preferences based on interaction history
 */
function updatePreferences(profile: UserProfile, articles: Article[]) {
  const articleMap = new Map(articles.map((a) => [a._id, a]));

  // Reset preferences
  profile.topicPreferences = {};
  profile.sourcePreferences = {};

  // Calculate time decay (older interactions worth less)
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  profile.interactionHistory.forEach((interaction) => {
    const article = articleMap.get(interaction.articleId);
    if (!article) return;

    // Calculate recency decay
    const age = now - interaction.timestamp;
    const decayFactor = Math.exp(-age / oneWeek);

    // Calculate interaction weight
    let weight = 0;
    switch (interaction.action) {
      case "favorite":
        weight = WEIGHTS.favorite;
        break;
      case "rate":
        if (interaction.rating && interaction.rating >= 4) {
          weight = WEIGHTS.highRating;
        } else if (interaction.rating === 3) {
          weight = WEIGHTS.mediumRating;
        }
        break;
      case "view":
        weight = WEIGHTS.view;
        break;
      case "click_topic":
        weight = WEIGHTS.topicClick;
        break;
    }

    const score = weight * decayFactor;

    // Update topic preferences
    if (article.topics) {
      article.topics.forEach((topic) => {
        profile.topicPreferences[topic] =
          (profile.topicPreferences[topic] || 0) + score;
      });
    }

    // Handle topic click separately
    if (interaction.action === "click_topic" && interaction.topic) {
      profile.topicPreferences[interaction.topic] =
        (profile.topicPreferences[interaction.topic] || 0) + score;
    }

    // Update source preferences
    if (article.source) {
      profile.sourcePreferences[article.source] =
        (profile.sourcePreferences[article.source] || 0) + score;
    }
  });

  return profile;
}

/**
 * Calculate personalized score for an article
 */
function calculateArticleScore(article: Article, profile: UserProfile): number {
  let score = 0;

  // Topic relevance
  if (article.topics && article.topics.length > 0) {
    const topicScores = article.topics.map(
      (topic) => profile.topicPreferences[topic] || 0
    );
    score += Math.max(...topicScores, 0);
  }

  // Source preference
  if (article.source) {
    score += profile.sourcePreferences[article.source] || 0;
  }

  // Boost for recent articles (less than 3 days old)
  if (article.fetchedAt) {
    const articleAge = Date.now() - new Date(article.fetchedAt).getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (articleAge < threeDays) {
      score += 1.0 * (1 - articleAge / threeDays);
    }
  }

  return score;
}

/**
 * Re-rank articles based on user preferences
 * Returns a new array with articles sorted by personalized score
 */
export function rerankArticles(articles: Article[]): Article[] {
  if (!articles || articles.length === 0) return articles;

  // Get and update user profile
  let profile = getUserProfile();

  // Only re-rank if user has some interaction history
  if (profile.interactionHistory.length === 0) {
    return articles; // No personalization, return original order
  }

  // Update preferences based on current articles
  profile = updatePreferences(profile, articles);
  saveUserProfile(profile);

  // Calculate scores and sort
  const scoredArticles = articles.map((article) => ({
    article,
    score: calculateArticleScore(article, profile),
  }));

  // Sort by score descending, but keep some randomness for diversity
  scoredArticles.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    // Add small random factor for diversity (±10% of score difference)
    const randomFactor = (Math.random() - 0.5) * 0.2 * Math.abs(scoreDiff);
    return scoreDiff + randomFactor;
  });

  return scoredArticles.map((item) => item.article);
}

/**
 * Get user's top topics
 */
export function getTopTopics(limit: number = 5): string[] {
  const profile = getUserProfile();
  if (Object.keys(profile.topicPreferences).length === 0) return [];

  return Object.entries(profile.topicPreferences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map((entry) => entry[0]);
}

/**
 * Clear user profile (for testing or privacy)
 */
export function clearUserProfile() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export user profile for debugging
 */
export function debugUserProfile() {
  const profile = getUserProfile();
  console.log("User Profile:", profile);
  console.log("Top Topics:", getTopTopics(10));
  console.log("Interaction Count:", profile.interactionHistory.length);
  return profile;
}
