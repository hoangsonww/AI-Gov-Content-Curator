import { BASE_URL } from "./api";

export interface Comment {
  _id: string;
  article: { _id: string; title: string };
  user: { _id: string; username: string; name?: string };
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPage {
  comments: Comment[];
  hasMore: boolean;
}

/**
 * Fetch comments for a given article, paginated.
 * GET /api/comments/article/:articleId?page=1&limit=10
 */
export async function fetchCommentsForArticle(
  articleId: string,
  page = 1,
  limit = 10,
  token?: string,
): Promise<CommentPage> {
  const url = new URL(`${BASE_URL}/comments/article/${articleId}`);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("limit", limit.toString());

  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: token } : {},
  });
  if (!res.ok) throw new Error("Failed to load comments");
  const json = await res.json();
  const comments: Comment[] = json.data;
  return {
    comments,
    hasMore: comments.length === limit,
  };
}

/**
 * Post a new comment on an article.
 * POST /api/comments/article/:articleId
 */
export async function postComment(
  articleId: string,
  content: string,
  token: string,
): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/comments/article/${articleId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return res.json() as Promise<Comment>;
}

/**
 * Update an existing comment.
 * PUT /api/comments/:commentId
 */
export async function updateCommentAPI(
  commentId: string,
  content: string,
  token: string,
): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/comments/${commentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to update comment");
  return res.json() as Promise<Comment>;
}

/**
 * Delete a comment.
 * DELETE /api/comments/:commentId
 */
export async function deleteCommentAPI(
  commentId: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}

/**
 * Vote on a comment (like/dislike).
 * POST /api/comments/:commentId/vote
 */
export async function voteCommentAPI(
  commentId: string,
  value: -1 | 0 | 1,
  token: string,
): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/comments/${commentId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error("Failed to vote on comment");
  return res.json() as Promise<Comment>;
}
