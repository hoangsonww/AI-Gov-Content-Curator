import { Router } from "express";
import {
  getFavoriteArticles,
  getFavoriteArticleIds,
  toggleFavoriteArticle,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Favorites
 *     description: Manage user's favorite articles
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
router.get("/favorites/articles", authenticate, getFavoriteArticles);

/**
 * @swagger
 * /api/users/favorites:
 *   get:
 *     tags: [Favorites]
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
router.get("/favorites", authenticate, getFavoriteArticleIds);

/**
 * @swagger
 * /api/users/favorite:
 *   post:
 *     tags: [Favorites]
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
 *                   description: Favorite status toggled
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: string
 *                     description: List of favorite article IDs
 *       400:
 *         description: Article ID is required
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/favorite", authenticate, toggleFavoriteArticle);

export default router;
