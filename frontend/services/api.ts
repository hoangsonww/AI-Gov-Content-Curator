import { Article } from "../pages/home";

// We may want to set this to an environment variable or another config.
// For now, we'll keep it hard-coded.
export const BASE_URL = "https://ai-content-curator-backend.vercel.app/api";

/**
 * Auth token helpers. All token reads/writes should go through these so that
 * same-tab listeners (e.g. AuthDropdown) can react immediately — the native
 * `storage` event only fires in OTHER tabs, so we emit a custom `auth:change`
 * event for the current tab.
 */
export const AUTH_EVENT = "auth:change";

export const setAuthToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { token } }));
};

export const clearAuthToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, { detail: { token: null } }),
  );
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

export interface BiasAnalysis {
  politicalLeaning: {
    position:
      | "far-left"
      | "left"
      | "center-left"
      | "center"
      | "center-right"
      | "right"
      | "far-right";
    score: number;
    explanation: string;
  };
  confidence: number;
  isBiased: boolean;
  biasIndicators: string[];
  neutralityScore: number;
  recommendation: string;
}

export interface BiasAnalysisResponse {
  success: boolean;
  data?: {
    title: string;
    contentLength: number;
    analysis: BiasAnalysis;
    timestamp: string;
  };
  error?: string;
  message?: string;
}

/**
 * Fetches the top 5 articles from the API.
 *
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 * @returns List of top articles or an empty array if an error occurs.
 */
export async function getTopArticles(
  retries = 3,
  delay = 1000,
): Promise<Article[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/articles?page=1&limit=5`);

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching top articles: ${res.statusText}`,
        );
        if (attempt === retries) return [];
      } else {
        const { data } = await res.json();
        return data || [];
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching top articles:`,
        error,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
}

/**
 * Fetches the total number of articles.
 *
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 * @returns Total article count or null if an error occurs.
 */
export const getTotalArticles = async (
  retries = 3,
  delay = 1000,
): Promise<number | null> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/articles/count`);

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching total articles: ${res.statusText}`,
        );
        if (attempt === retries) return 0;
      } else {
        const result = await res.json();
        return result.total;
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching total articles:`,
        error,
      );
      if (attempt === retries) return 0;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return 0;
};

/**
 * Fetches the latest 10 articles from the API.
 *
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 * @returns List of latest articles or an empty array if an error occurs.
 */
export async function getLatestArticles(
  retries = 3,
  delay = 1000,
): Promise<Article[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/articles?page=1&limit=10`);

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching latest articles: ${res.statusText}`,
        );
        if (attempt === retries) return [];
      } else {
        const { data } = await res.json();
        return data || [];
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching latest articles:`,
        error,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
}

/**
 * Fetches a single article by its ID.
 * Returns `null` if the article is not found or an error occurs.
 *
 * @param id The article ID to fetch.
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 */
export async function getArticleById(
  id: string,
  retries = 3,
  delay = 1000,
): Promise<Article | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/articles/${id}`);

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching article (${id}): ${res.statusText}`,
        );
        if (attempt === retries) return null;
      } else {
        const article = await res.json();
        return article ? JSON.parse(JSON.stringify(article)) : null;
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching article (${id}):`,
        error,
      );
      if (attempt === retries) return null;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

/**
 * Fetches a paginated list of articles from the API.
 * Returns an empty array if the request fails.
 *
 * @param page The page number to fetch.
 * @param limit The number of articles per page (default: 10).
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 * @returns List of articles or an empty array if an error occurs.
 */
export async function getArticles(
  page: number,
  limit = 10,
  retries = 3,
  delay = 1000,
): Promise<Article[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `${BASE_URL}/articles?page=${page}&limit=${limit}`,
      );

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching articles (Page ${page}): ${res.statusText}`,
        );
        if (attempt === retries) return [];
      } else {
        const { data } = await res.json();
        return data || [];
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching articles (Page ${page}):`,
        error,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
}

/**
 * Searches for articles by query and/or topic.
 * Returns an empty array if the request fails.
 *
 * @param q The search query (by title or summary).
 * @param topic The topic filter.
 * @param page The page number (default: 1).
 * @param limit The number of articles per page (default: 10).
 * @param retries Number of retry attempts.
 * @param delay Delay between retries in milliseconds.
 * @returns List of matching articles or an empty array if an error occurs.
 */
export async function searchArticles(
  q: string,
  topic: string,
  page = 1,
  limit = 10,
  retries = 3,
  delay = 1000,
): Promise<Article[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = new URL(`${BASE_URL}/articles/search`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", limit.toString());
      if (q) url.searchParams.set("q", q);
      if (topic) url.searchParams.set("topic", topic);

      const res = await fetch(url.toString());

      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error searching articles: ${res.statusText}`,
        );
        if (attempt === retries) return [];
      } else {
        const { data } = await res.json();
        return data || [];
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while searching articles:`,
        error,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
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
    if (!res.ok) throw new Error(data.error || "Login failed. Please retry.");

    if (data?.token) setAuthToken(data.token);

    return data;
  } catch (error: any) {
    throw new Error(
      error.message || "An error occurred during login. Please retry.",
    );
  }
};

/* ───────────── Passkey (WebAuthn) ───────────── */

/**
 * Returns true when the current browser exposes the WebAuthn API.
 */
export const isPasskeySupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).PublicKeyCredential !== "undefined"
  );
};

const authHeader = (): Record<string, string> => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: token } : {};
};

const postJson = async (path: string, body: any, withAuth = false) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withAuth ? authHeader() : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed. Please retry.");
  return data;
};

/**
 * Sign in with a passkey. Discoverable / usernameless flow.
 * Stores the JWT in localStorage on success — exact same key as loginUser.
 */
export const loginWithPasskey = async () => {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const options = await postJson("/auth/passkey/authenticate/begin", {});
  const response = await startAuthentication({ optionsJSON: options });
  const data = await postJson("/auth/passkey/authenticate/verify", {
    response,
  });
  if (data?.token) setAuthToken(data.token);
  return data;
};

/**
 * Sign up with a passkey only (no password). Creates a new account and
 * stores the JWT.
 */
export const signupWithPasskey = async (
  email: string,
  name?: string,
  nickname?: string,
) => {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const options = await postJson("/auth/passkey/signup/begin", {
    email,
    name,
  });
  const response = await startRegistration({ optionsJSON: options });
  const data = await postJson("/auth/passkey/signup/verify", {
    email,
    response,
    nickname,
  });
  if (data?.token) setAuthToken(data.token);
  return data;
};

/**
 * Add a passkey to the currently logged-in account.
 */
export const registerPasskey = async (nickname?: string) => {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const options = await postJson("/auth/passkey/register/begin", {}, true);
  const response = await startRegistration({ optionsJSON: options });
  return postJson(
    "/auth/passkey/register/verify",
    { response, nickname },
    true,
  );
};

export interface PasskeySummary {
  id: string;
  nickname: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
}

/**
 * List the current user's passkeys.
 */
export const listPasskeys = async (): Promise<PasskeySummary[]> => {
  const res = await fetch(`${BASE_URL}/auth/passkey`, {
    headers: { ...authHeader() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to load passkeys");
  return data;
};

/**
 * Rename a passkey.
 */
export const renamePasskey = async (id: string, nickname: string) => {
  const res = await fetch(`${BASE_URL}/auth/passkey/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ nickname }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to rename passkey");
  return data;
};

/**
 * Delete a passkey.
 */
export const deletePasskey = async (id: string) => {
  const res = await fetch(`${BASE_URL}/auth/passkey/${id}`, {
    method: "DELETE",
    headers: { ...authHeader() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to delete passkey");
  return data;
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
    if (!res.ok)
      throw new Error(data.error || "Registration failed. Please retry.");

    return data;
  } catch (error: any) {
    throw new Error(
      error.message || "An error occurred during registration. Please retry.",
    );
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
    if (!res.ok)
      throw new Error(
        data.error || "Failed to request reset token. Please retry.",
      );

    return data;
  } catch (error: any) {
    throw new Error(
      error.message ||
        "An error occurred while requesting reset token. Please retry.",
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
    if (!res.ok)
      throw new Error(data.error || "Password reset failed. Please retry.");

    return data;
  } catch (error: any) {
    console.error(
      error.message ||
        "An error occurred while resetting password. Please retry.",
    );
  }
};

/**
 * Fetches favorite articles for the logged-in user.
 *
 * @param token - User's authentication token.
 * @param retries - Number of retry attempts (default: 3).
 * @param delay - Delay between retries in milliseconds (default: 1000).
 * @returns List of favorite articles.
 */
export const fetchFavoriteArticles = async (
  token: string,
  retries = 3,
  delay = 1000,
): Promise<Article[]> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/users/favorites/articles`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token, // No 'Bearer ' prefix
        },
      });

      if (!res.ok) {
        console.error(`Attempt ${attempt}: ${await res.text()}`);
        if (attempt === retries) return [];
      } else {
        return await res.json();
      }
    } catch (error: any) {
      console.error(
        `Attempt ${attempt}: ${error.message || "Failed to fetch favorite articles."}`,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
};

/**
 * Fetches favorite articles for the logged-in user.
 *
 * @param token - User's authentication token.
 * @param retries - Number of retry attempts (default: 3).
 * @param delay - Delay between retries in milliseconds (default: 1000).
 * @returns Array of favorite article IDs.
 */
export const fetchFavoriteArticleIds = async (
  token: string,
  retries = 3,
  delay = 1000,
): Promise<string[]> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/users/favorites`, {
        headers: { Authorization: token },
      });

      if (!res.ok) {
        console.error(`Attempt ${attempt}: ${await res.text()}`);
        if (attempt === retries) return [];
      } else {
        const data = await res.json();
        return data.favorites || [];
      }
    } catch (error: any) {
      console.error(
        `Attempt ${attempt}: ${error.message || "Failed to fetch favorite articles."}`,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
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
    console.error(
      error.message || "Failed to toggle favorite status. Please retry.",
    );
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
  retries: number = 2,
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
        return data.valid === true;
      }

      // 401 means the JWT itself is bad — definitive. Drop it.
      if (res.status === 401) {
        clearAuthToken();
        return false;
      }

      // 403 / 429 / 5xx are usually transient (Vercel edge throttling, WAF,
      // upstream blip). Don't drop the token; treat as "still valid for now"
      // so we don't force a re-login on every flaky request.
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        return true;
      }

      console.warn(
        `Token validation got unexpected ${res.status} (attempt ${attempt}/${retries})`,
      );

      if (attempt === retries) return true; // be conservative; don't log user out
      await delay(300 * attempt);
    } catch (error: any) {
      console.warn(
        `Network error validating token (attempt ${attempt}/${retries}):`,
        error?.message || "Unknown error.",
      );
      if (attempt === retries) return true; // network blip — keep session
      await delay(500 * attempt);
    }
  }

  return true;
};

/**
 * Fetches topics from the API.
 * Supports searching the topics list using the 'q' query parameter.
 * Also supports pagination with 'page' and 'limit' query parameters.
 *
 * @param q The search query to filter topics (optional).
 * @param page The page number (default: 1).
 * @param limit The number of topics per page (default: 10).
 * @param retries Number of retry attempts (default: 3).
 * @param delay Delay between retries in milliseconds (default: 1000).
 * @returns An object containing 'data' (an array of topics) and 'total' (the total count of topics).
 */
export async function getTopics(
  q: string = "",
  page: number = 1,
  limit: number = 10,
  retries: number = 3,
  delay: number = 1000,
): Promise<{ data: string[]; total: number }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = new URL(`${BASE_URL}/articles/topics`);
      if (q) url.searchParams.set("q", q);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", limit.toString());
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching topics: ${res.statusText}`,
        );
        if (attempt === retries) return { data: [], total: 0 };
      } else {
        const result = await res.json();
        return { data: result.data || [], total: result.total || 0 };
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching topics:`,
        error,
      );
      if (attempt === retries) return { data: [], total: 0 };
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return { data: [], total: 0 };
}

/**
 * Fetches articles filtered by a specific topic using the API endpoint.
 *
 * @param topic The topic to filter articles by.
 * @param page The page number (default: 1).
 * @param limit The number of articles per page (default: 10).
 * @param retries Number of retry attempts (default: 3).
 * @param delay Delay between retries in milliseconds (default: 1000).
 * @returns A list of articles filtered by the given topic or an empty array if an error occurs.
 */
export async function getArticlesByTopic(
  topic: string,
  page: number = 1,
  limit: number = 10,
  retries: number = 3,
  delay: number = 1000,
): Promise<Article[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = new URL(
        `${BASE_URL}/articles/topic/${encodeURIComponent(topic)}`,
      );
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", limit.toString());

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(
          `Attempt ${attempt}: Error fetching articles by topic: ${res.statusText}`,
        );
        if (attempt === retries) return [];
      } else {
        const result = await res.json();
        return result.data || [];
      }
    } catch (error) {
      console.error(
        `Attempt ${attempt}: Network error while fetching articles by topic:`,
        error,
      );
      if (attempt === retries) return [];
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return [];
}

/**
 * Analyzes an article for political bias and leaning.
 * Implements caching to avoid redundant API calls.
 *
 * @param articleId The unique identifier of the article.
 * @param title The title of the article.
 * @param content The content of the article to analyze.
 * @returns Bias analysis data or null if an error occurs.
 */
export async function analyzeArticleBias(
  articleId: string,
  title: string,
  content: string,
): Promise<BiasAnalysis | null> {
  // Check cache first
  const cacheKey = `bias_analysis_${articleId}`;
  const cachedData = localStorage.getItem(cacheKey);

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      // Check if cache is less than 30 days old
      const cacheTime = parsed.timestamp || 0;
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - cacheTime < thirtyDaysInMs) {
        return parsed.analysis;
      }
    } catch (error) {
      console.error("Error parsing cached bias data:", error);
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch from API if not cached
  try {
    const response = await fetch(`${BASE_URL}/bias/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      console.error("Error analyzing article bias:", response.statusText);
      return null;
    }

    const result: BiasAnalysisResponse = await response.json();

    if (result.success && result.data?.analysis) {
      // Cache the result
      const cacheData = {
        analysis: result.data.analysis,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.error("Error caching bias analysis:", error);
      }

      return result.data.analysis;
    }

    return null;
  } catch (error) {
    console.error("Network error while analyzing article bias:", error);
    return null;
  }
}
