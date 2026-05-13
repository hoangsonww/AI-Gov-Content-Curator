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

/**
 * Set user preferences from onboarding quiz
 *
 * @param req The request object containing preferences data in the body
 * @param res The response object to send the updated user preferences
 */
export const setUserPreferences = async (req: Request, res: Response) => {
  const { topics, sources, alertFrequency, notifyOnNewStories } = req.body;

  // Validate that if topics is provided, it must be an array
  if (topics !== undefined && (!Array.isArray(topics))) {
    return res.status(400).json({ error: "Topics must be an array if provided" });
  }

  // Validate that if sources is provided, it must be an array
  if (sources !== undefined && (!Array.isArray(sources))) {
    return res.status(400).json({ error: "Sources must be an array if provided" });
  }

  // Alert frequency is still required
  if (!alertFrequency || !['hourly', 'daily', 'weekly', 'monthly'].includes(alertFrequency)) {
    return res.status(400).json({ error: "Alert frequency must be one of: hourly, daily, weekly, monthly" });
  }

  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Update user preferences
    user.preferences = {
      topics: topics || [],
      sources: sources || [],
      alertFrequency: alertFrequency as 'hourly' | 'daily' | 'weekly' | 'monthly',
      notifyOnNewStories: notifyOnNewStories ?? false,
    };

    if(!user.isOnboarded){
        user.isOnboarded = true;
    }
  

    await user.save();

    return res.status(200).json({
      message: "Preferences updated successfully",
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Error setting user preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get user preferences for the logged-in user
 *
 * @param req The request object containing user information
 * @param res The response object to send the user preferences
 */
export const getUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.isOnboarded) {
      return res.status(404).json({ error: "Preferences not set" });
    }

    return res.status(200).json({
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Error getting user preferences:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update user first week engagement with new interaction
 *
 * @param req The request object containing interaction data in the body
 * @param res The response object indicating success or failure
 */
export const updateFirstWeekEngagement = async (req: Request, res: Response) => {
  const { action } = req.body;

  // Validate the action
  if (action === undefined)  {
    return res.status(400).json({ error: "Action must be provided" });
  }

  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Update user preferences
    switch (action) {
      case "favorite":
        user.firstWeekInteractions.article_favs += 1;
        break;
      case "rate":
        user.firstWeekInteractions.article_ratings += 1;
        break;
      case "view":
        user.firstWeekInteractions.article_views += 1;
        break;
      case "click_topic":
        user.firstWeekInteractions.topic_clicks += 1;
        break;
    }

    await user.save();

    return res.status(200).json({
      message: "Engagement metrics updated successfully",
      firstWeekInteractions : user.firstWeekInteractions,
    });
  } catch (error) {
    console.error("Error updating engagement statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get signup date for the logged-in user
 *
 * @param req The request object containing user information
 * @param res The response object to send the signup date
 */
export const getSignupDate = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const signupDate = user.createdAt ;
    return res.status(200).json({signupDate});
  } catch (error) {
    console.error("Error retrieving signup date:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};