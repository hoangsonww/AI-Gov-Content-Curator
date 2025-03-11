import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Article from "../models/article.model";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// JWT authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded; // attach decoded info (e.g., id, email) to req.user
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * @swagger
 * tags:
 *   name: Favorites
 *   description: Manage user's favorite articles
 */

/**
 * @swagger
 * /api/users/favorites/articles:
 *   get:
 *     summary: Retrieve full details of favorite articles for logged-in user
 *     tags: [Favorites]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved favorite articles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Unique identifier of the article.
 *                   url:
 *                     type: string
 *                     description: The original URL of the article.
 *                   title:
 *                     type: string
 *                     description: The title of the article.
 *                   content:
 *                     type: string
 *                     description: The full content of the article.
 *                   summary:
 *                     type: string
 *                     description: A short summary of the article.
 *                   source:
 *                     type: string
 *                     description: The source or publisher of the article.
 *                   fetchedAt:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp when the article was fetched.
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/favorites/articles",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const articles = await Article.find({ _id: { $in: user.favorites } }); // Fetch full articles
      return res.json(articles);
    } catch (error) {
      console.error("Error retrieving favorite articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * @swagger
 * /api/users/favorites:
 *   get:
 *     tags:
 *       - Favorites
 *     summary: Retrieve favorite article IDs for the logged-in user
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved favorite article IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/favorites", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ favorites: user.favorites });
  } catch (error) {
    console.error("Error retrieving favorites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/users/favorite:
 *   post:
 *     tags:
 *       - Favorites
 *     summary: Toggle favorite status for an article
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: The ID of the article to favorite/unfavorite
 *             required:
 *               - articleId
 *     responses:
 *       200:
 *         description: Successfully toggled favorite status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 description: Favorite status toggled
 *               favorites:
 *                 type: array
 *                 items:
 *                   type: string
 *       400:
 *         description: Article ID is required
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/favorite", authenticate, async (req: Request, res: Response) => {
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
});

export default router;
