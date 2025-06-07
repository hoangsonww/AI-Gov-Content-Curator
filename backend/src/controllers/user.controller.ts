import { Request, Response } from "express";
import User from "../models/user.model";
import Article from "../models/article.model";

/**
 * Get favorite articles for the logged-in user
 *
 * @param req The request object containing user information
 * @param res The response object to send the list of favorite articles
 */
export const getFavoriteArticles = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const articles = await Article.find({ _id: { $in: user.favorites } });
    return res.json(articles);
  } catch (error) {
    console.error("Error retrieving favorite articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get favorite article IDs for the logged-in user
 *
 * @param req The request object containing user information
 * @param res The response object to send the list of favorite article IDs
 */
export const getFavoriteArticleIds = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ favorites: user.favorites });
  } catch (error) {
    console.error("Error retrieving favorites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Toggle favorite status of an article for the logged-in user
 *
 * @param req The request object containing article ID in the body
 * @param res The response object to send the updated list of favorite articles
 */
export const toggleFavoriteArticle = async (req: Request, res: Response) => {
  const { articleId } = req.body;
  if (!articleId)
    return res.status(400).json({ error: "Article ID is required" });

  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Toggle favorite: if already favorited, remove it; otherwise, add it.
    if (user.favorites.includes(articleId)) {
      user.favorites = user.favorites.filter((id: string) => id !== articleId);
      await user.save();
      return res.json({
        message: "Article unfavorited",
        favorites: user.favorites,
      });
    } else {
      user.favorites.push(articleId);
      await user.save();
      return res.json({
        message: "Article favorited",
        favorites: user.favorites,
      });
    }
  } catch (error) {
    console.error("Error favoriting article:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Validate user token
 *
 * @param req The request object
 * @param res The response object
 */
export const validateTokenController = async (req: Request, res: Response) => {
  return res.status(200).json({ valid: true });
};

/**
 * Search favorite articles for the logged-in user by title or summary.
 * Supports pagination through 'page' and 'limit' query parameters.
 *
 * @param req The request object containing the search query and pagination parameters
 * @param res The response object to send the search results or an error message
 */
export const searchFavoriteArticles = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { q, page = 1, limit = 10 } = req.query;
    const queryFilter: any = {
      _id: { $in: user.favorites },
    };

    if (q) {
      queryFilter.$or = [
        { title: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
      ];
    }

    const articles = await Article.find(queryFilter)
      .select("-content")
      .sort({ fetchedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const count = await Article.countDocuments(queryFilter);
    res.json({ data: articles, total: count });
  } catch (error) {
    console.error("Error searching favorite articles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all users (for admin purposes)
 * @param _req - Request
 * @param res - Response
 */
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find()
      .select("_id username name")
      .sort({ username: 1 });
    res.json({ data: users });
  } catch (error) {
    console.error("Error retrieving all users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
