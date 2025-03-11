import { Article } from "../pages";

// We may want to set this to an environment variable or another config.
// For now, we'll keep it hard-coded.
const BASE_URL = "https://ai-content-curator-backend.vercel.app/api";

/**
 * Fetches the top 5 articles from the API.
 */
export async function getTopArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${BASE_URL}/articles?page=1&limit=5`);

    if (!res.ok) {
      console.error(`Error fetching top articles: ${res.statusText}`);
      return [];
    }

    const { data } = await res.json();
    return data || [];
  } catch (error) {
    console.error("Network error while fetching top articles:", error);
    return [];
  }
}

/**
 * Fetches the total number of articles.
 * @returns Total article count or null if an error occurs.
 */
export const getTotalArticles = async (): Promise<number | null> => {
  try {
    const res = await fetch(`${BASE_URL}/articles/count`);

    if (!res.ok) {
      console.error(`Error fetching total articles: ${res.statusText}`);
      return null;
    }

    const result = await res.json();
    return result.total;
  } catch (error) {
    console.error("Network error while fetching total articles:", error);
    return null;
  }
};

/**
 * Fetches the latest 10 articles from the API.
 */
export async function getLatestArticles(): Promise<Article[]> {
  try {
    const res = await fetch(`${BASE_URL}/articles?page=2&limit=10`);

    if (!res.ok) {
      console.error(`Error fetching latest articles: ${res.statusText}`);
      return [];
    }

    const { data } = await res.json();
    return data || [];
  } catch (error) {
    console.error("Network error while fetching latest articles:", error);
    return [];
  }
}

/**
 * Fetches a single article by its ID.
 * Returns `null` if the article is not found or an error occurs.
 *
 * @param id The article ID to fetch.
 */
export async function getArticleById(id: string): Promise<Article | null> {
  try {
    const res = await fetch(`${BASE_URL}/articles/${id}`);

    if (!res.ok) {
      console.error(`Error fetching article (${id}): ${res.statusText}`);
      return null;
    }

    const article = await res.json();
    return article ? JSON.parse(JSON.stringify(article)) : null;
  } catch (error) {
    console.error(`Network error while fetching article (${id}):`, error);
    return null;
  }
}

/**
 * Fetches a paginated list of articles from the API.
 * Returns an empty array if the request fails.
 *
 * @param page The page number to fetch.
 * @param limit The number of articles per page (default: 10).
 */
export async function getArticles(
  page: number,
  limit = 10,
): Promise<Article[]> {
  try {
    const res = await fetch(`${BASE_URL}/articles?page=${page}&limit=${limit}`);

    if (!res.ok) {
      console.error(
        `Error fetching articles (Page ${page}): ${res.statusText}`,
      );
      return [];
    }

    const { data } = await res.json();
    return data || [];
  } catch (error) {
    console.error(
      `Network error while fetching articles (Page ${page}):`,
      error,
    );
    return [];
  }
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
    console.error(
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
      console.error(await res.text());
      return [];
    }

    return await res.json();
  } catch (error: any) {
    console.error(error.message || "Failed to fetch favorite articles.");
    return [];
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
      console.error(await res.text());
      return [];
    }

    const data = await res.json();
    return data.favorites || [];
  } catch (error: any) {
    console.error(error.message || "Failed to fetch favorite articles.");
    return [];
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
      console.error(await res.text());
      return [];
    }
  } catch (error: any) {
    console.error(error.message || "Failed to toggle favorite status.");
    return [];
  }
};

/**
 * Validates the user's authentication token with retries.
 * Calls the backend `/api/users/validate-token` to check if the token is still valid.
 *
 * @param token - User's authentication token.
 * @param retries - Number of retry attempts (default: 3).
 * @returns `true` if the token is valid, `false` otherwise.
 */
export const validateToken = async (
  token: string,
  retries: number = 3,
): Promise<boolean> => {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/users/validate-token`, {
        headers: { Authorization: token },
      });

      if (res.ok) {
        const data = await res.json();
        return data.valid === true; // Ensure response contains `{ valid: true }`
      }

      console.error(
        `Token validation failed (Attempt ${attempt}/${retries}):`,
        await res.text(),
      );

      // If last attempt, remove token
      if (attempt === retries) {
        localStorage.removeItem("token");
        return false;
      }

      // Wait before retrying (exponential backoff: 200ms, 400ms, 600ms)
      await delay(200 * attempt);
    } catch (error: any) {
      console.error(
        `Error validating token (Attempt ${attempt}/${retries}):`,
        error.message || "Unknown error.",
      );

      // If last attempt, remove token
      if (attempt === retries) {
        localStorage.removeItem("token");
        return false;
      }

      await delay(500 * attempt);
    }
  }

  return false; // Should never reach here
};
