import { Article } from "../pages";

// We may want to set this to an environment variable or another config.
// For now, we'll keep it hard-coded.
const BASE_URL = "https://ai-content-curator-backend.vercel.app/api";

/**
 * Fetches the top 5 articles from the API.
 */
export async function getTopArticles(): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=1&limit=5`);
  if (!res.ok) throw new Error("Failed to fetch top articles");
  const { data } = await res.json();
  return data || [];
}

/**
 * Fetches the latest 10 articles from the API.
 */
export async function getLatestArticles(): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=2&limit=10`);
  if (!res.ok) throw new Error("Failed to fetch latest articles");
  const { data } = await res.json();
  return data || [];
}

/**
 * Fetches all articles from the API.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  const res = await fetch(`${BASE_URL}/articles/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch article with id ${id}`);

  // Expect the API to return the article object directly.
  const article = await res.json();
  return article ? JSON.parse(JSON.stringify(article)) : null;
}

/**
 * Fetches articles from the API, for a given page and limit.
 *
 * @param page The page number to fetch
 * @param limit The number of articles to fetch per page
 */
export async function getArticles(
  page: number,
  limit = 10,
): Promise<Article[]> {
  const res = await fetch(`${BASE_URL}/articles?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch articles for page ${page}`);

  const { data } = await res.json();
  return data || [];
}

/**
 * Logs in the user.
 * @param email - User's email
 * @param password - User's password
 * @returns User data and token or an error message
 */
export const loginUser = async (email: string, password: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    // Save token to localStorage
    localStorage.setItem("token", data.token);
    return data;
  } catch (error: any) {
    throw new Error(error.message || "An error occurred during login.");
  }
};

/**
 * Registers a new user.
 * @param name - User's name
 * @param email - User's email
 * @param password - User's password
 * @returns Registration success message or an error
 */
export const registerUser = async (
  name: string,
  email: string,
  password: string,
) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    return data;
  } catch (error: any) {
    throw new Error(error.message || "An error occurred during registration.");
  }
};

/**
 * Requests a password reset token.
 * @param email - User's email
 * @returns Reset token if successful
 */
export const requestPasswordReset = async (email: string) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to request reset token");

    return data;
  } catch (error: any) {
    throw new Error(
      error.message || "An error occurred while requesting reset token.",
    );
  }
};

/**
 * Confirms password reset.
 * @param email - User's email
 * @param token - Reset token received via email
 * @param newPassword - New password
 * @returns Success message if successful
 */
export const confirmPasswordReset = async (
  email: string,
  token: string,
  newPassword: string,
) => {
  try {
    const res = await fetch(`${BASE_URL}/auth/confirm-reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Password reset failed");

    return data;
  } catch (error: any) {
    throw new Error(
      error.message || "An error occurred while resetting password.",
    );
  }
};

/**
 * Fetches favorite articles for the logged-in user.
 * @param token - User's authentication token.
 * @returns List of favorite articles.
 */
export const fetchFavoriteArticles = async (token: string) => {
  try {
    const res = await fetch(`${BASE_URL}/users/favorites/articles`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token, // No 'Bearer ' prefix
      },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return await res.json();
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch favorite articles.");
  }
};

/**
 * Fetches favorite articles for the logged-in user.
 * @param token - User's authentication token.
 * @returns Array of favorite article IDs.
 */
export const fetchFavoriteArticleIds = async (token: string) => {
  try {
    const res = await fetch(`${BASE_URL}/users/favorites`, {
      headers: { Authorization: token },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return data.favorites || [];
  } catch (error: any) {
    throw new Error(error.message || "Failed to fetch favorite articles.");
  }
};

/**
 * Toggles the favorite status of an article.
 * @param token - User's authentication token.
 * @param articleId - The article ID to be favorited/unfavorited.
 */
export const toggleFavoriteArticle = async (
  token: string,
  articleId: string,
) => {
  try {
    const res = await fetch(`${BASE_URL}/users/favorite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ articleId }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }
  } catch (error: any) {
    throw new Error(error.message || "Failed to toggle favorite status.");
  }
};
