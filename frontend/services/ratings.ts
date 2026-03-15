import { BASE_URL } from "./api";

export interface RatingUser {
  name?: string;
  email?: string;
}

export interface Rating {
  _id?: string;
  articleId: string;
  userId?: string | RatingUser;
  value: number;
  ratingType: "meter" | "stars";
  sessionId?: string;
  comment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RatingWithUser extends Rating {
  userId?: RatingUser | string;
}

export interface RatingStats {
  articleId: string;
  averageRating: number;
  averageMeterRating?: number | null;
  averageStarRating?: number | null;
  totalRatings: number;
  meterRatings: number;
  starRatings: number;
  meterDistribution?: { [key: string]: number };
  starDistribution?: { [key: number]: number };
}

export interface RatingsListResponse {
  ratings: RatingWithUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Helper function to get or create session ID
export const getSessionId = (): string => {
  if (typeof window === "undefined") return "";

  let sessionId = localStorage.getItem("ratingSessionId");
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("ratingSessionId", sessionId);
  }
  return sessionId;
};

/**
 * Create or update a rating for an article
 */
export async function createOrUpdateRating(
  articleId: string,
  value: number,
  ratingType: "meter" | "stars" = "meter",
  comment?: string,
): Promise<{ success: boolean; data?: Rating; message?: string }> {
  try {
    const sessionId = getSessionId();
    const token = localStorage.getItem("token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/ratings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        articleId,
        value,
        ratingType,
        comment,
        sessionId: !token ? sessionId : undefined,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating/updating rating:", error);
    return { success: false, message: "Failed to submit rating" };
  }
}

/**
 * Get the current user's/session's rating for an article
 */
export async function getUserRating(articleId: string): Promise<Rating | null> {
  try {
    const sessionId = getSessionId();
    const token = localStorage.getItem("token");

    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = token
      ? `${BASE_URL}/ratings/article/${articleId}/user`
      : `${BASE_URL}/ratings/article/${articleId}/user?sessionId=${sessionId}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch user rating: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching user rating:", error);
    return null;
  }
}

/**
 * Get rating statistics for an article
 */
export async function getArticleRatingStats(
  articleId: string,
): Promise<RatingStats | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/ratings/article/${articleId}/stats`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch rating stats: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching rating stats:", error);
    return null;
  }
}

/**
 * Get all ratings for an article (paginated)
 */
export async function getArticleRatingsList(
  articleId: string,
  page: number = 1,
  limit: number = 50,
): Promise<RatingsListResponse | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/ratings/article/${articleId}?page=${page}&limit=${limit}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ratings: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error("Error fetching article ratings:", error);
    return null;
  }
}

/**
 * Delete a rating
 */
export async function deleteRating(
  ratingId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const sessionId = getSessionId();
    const token = localStorage.getItem("token");

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/ratings/${ratingId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        sessionId: !token ? sessionId : undefined,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting rating:", error);
    return { success: false, message: "Failed to delete rating" };
  }
}

/**
 * Get bulk ratings for multiple articles
 */
export async function getBulkArticleRatings(
  articleIds: string[],
): Promise<
  Array<{ articleId: string; averageRating: number; totalRatings: number }>
> {
  try {
    const response = await fetch(`${BASE_URL}/ratings/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ articleIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bulk ratings: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching bulk ratings:", error);
    return [];
  }
}
