import { Request, Response } from "express";
import Comment, { IComment } from "../models/comment.model";
import { Types } from "mongoose";

/**
 * Helper to ensure req.user is present.
 */
function requireUser(req: Request): {
  id: string;
  username: string;
  name?: string;
} {
  if (!req.user) {
    throw { status: 401, message: "Authentication required" };
  }
  // We expect req.user.id to be a string from the JWT payload
  return req.user as any;
}

export const getCommentsByArticle = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    if (!Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    const comments = await Comment.find({ article: articleId })
      .populate("user", "_id username name")
      .populate("article", "_id title")
      .sort({ createdAt: -1 });
    res.json({ data: comments });
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to load comments" });
  }
};

export const getAllComments = async (_req: Request, res: Response) => {
  try {
    const comments = await Comment.find()
      .populate("user", "_id username name")
      .populate("article", "_id title")
      .sort({ createdAt: -1 });
    res.json({ data: comments });
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to load comments" });
  }
};

export const getCommentsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const comments = await Comment.find({ user: userId })
      .populate("user", "_id username name")
      .populate("article", "_id title")
      .sort({ createdAt: -1 });
    res.json({ data: comments });
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to load user comments" });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const me = requireUser(req);
    const { articleId } = req.params;
    const { content } = req.body;

    if (!Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ error: "Invalid article ID" });
    }
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Create & save, converting me.id (string) into an ObjectId
    const comment = new Comment({
      article: new Types.ObjectId(articleId),
      user: new Types.ObjectId(me.id),
      content: content.trim(),
    } as Partial<IComment>);
    await comment.save();

    // Populate before returning
    await comment.populate("user", "_id username name");
    await comment.populate("article", "_id title");

    res.status(201).json(comment);
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to add comment" });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    const me = requireUser(req);
    const { id } = req.params;
    const { content } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Load and check ownership
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (comment.user.toHexString() !== me.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Update & save
    comment.content = content.trim();
    await comment.save();

    // Populate before returning
    await comment.populate("user", "_id username name");
    await comment.populate("article", "_id title");

    res.json(comment);
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to update comment" });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const me = requireUser(req);
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }

    // Verify ownership
    const existing = await Comment.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (existing.user.toHexString() !== me.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await existing.remove();
    res.status(204).send();
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to delete comment" });
  }
};

type VoteValue = -1 | 0 | 1;

/**
 * Records or clears a vote by the authenticated user on the specified comment.
 * Only the calling user’s own vote array is modified.
 */
export const voteComment = async (req: Request, res: Response) => {
  try {
    const me = requireUser(req);
    const { id } = req.params;
    const { value } = req.body as { value: VoteValue };

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }
    if (![-1, 0, 1].includes(value)) {
      return res.status(400).json({ error: "`value` must be -1, 0, or 1" });
    }

    // 1) Load the comment document
    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    // 2) Remove any existing vote by this user
    comment.upvotes.pull(me.id);
    comment.downvotes.pull(me.id);

    // 3) Apply the new vote
    if (value === 1) {
      comment.upvotes.addToSet(me.id);
    } else if (value === -1) {
      comment.downvotes.addToSet(me.id);
    }
    // if value === 0, cleared

    // 4) Save and return
    await comment.save();
    await comment.populate("user", "_id username name");
    await comment.populate("article", "_id title");

    res.json(comment);
  } catch (err: any) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Failed to vote" });
  }
};
