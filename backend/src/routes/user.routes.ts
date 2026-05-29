import { Router } from "express";
import {
  getFavoriteArticles,
  getFavoriteArticleIds,
  toggleFavoriteArticle,
  validateTokenController,
  searchFavoriteArticles,
  getAllUsers,
  setUserPreferences,
  getUserPreferences,
  updateFirstWeekEngagement,
  getSignupDate
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
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Retrieve all users
 *     description: Fetches a list of all registered users with basic info.
 *     responses:
 *       200:
 *         description: Array of user objects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       name:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get("/", getAllUsers);

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
 *                   topics:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: List of topics associated with the article.
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
 *                   description: List of favorite article IDs.
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
 *                 description: The ID of the article to favorite/unfavorite.
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
 *                   description: Favorite status toggled.
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Updated list of favorite article IDs.
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

/**
 * @swagger
 * /api/users/favorites/search:
 *   get:
 *     tags: [Favorites]
 *     summary: Search favorite articles by title or summary
 *     description: Retrieve favorite articles for the logged-in user that match the search query in either the title or summary fields.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: The search query to filter articles by title or summary.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of articles per page.
 *     responses:
 *       200:
 *         description: Successfully retrieved search results of favorite articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Unique identifier of the article.
 *                       url:
 *                         type: string
 *                         description: The original URL of the article.
 *                       title:
 *                         type: string
 *                         description: The title of the article.
 *                       content:
 *                         type: string
 *                         description: The full content of the article.
 *                       topics:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: List of topics associated with the article.
 *                       summary:
 *                         type: string
 *                         description: A short summary of the article.
 *                       source:
 *                         type: string
 *                         description: The source or publisher of the article.
 *                       fetchedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the article was fetched.
 *                 total:
 *                   type: integer
 *                   description: Total number of matching favorite articles.
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/favorites/search", authenticate, searchFavoriteArticles);

/**
 * @swagger
 * /api/users/validate-token:
 *   get:
 *     tags: [Authentication]
 *     summary: Validate the current authentication token
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether the token is valid or not.
 *       401:
 *         description: Token is missing or invalid
 */
router.get("/validate-token", authenticate, validateTokenController);

/**
 * @swagger
 * /api/users/preferences:
 *   post:
 *     tags: [Preferences]
 *     summary: Set user preferences from onboarding quiz
 *     description: Save user's topic interests, preferred sources, alert frequency, and notification preferences. Topics and sources are optional if the user skipped those steps.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user's interested topics (optional if skipped)
 *                 example: ["Climate Change", "Technology"]
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user's preferred sources (optional if skipped)
 *                 example: ["BBC", "Reuters"]
 *               alertFrequency:
 *                 type: string
 *                 enum: [hourly, daily, weekly, monthly, never]
 *                 description: Preferred alert frequency
 *                 example: "daily"
 *               notifyOnNewStories:
 *                 type: boolean
 *                 description: Whether user wants instant notifications on new stories
 *                 example: true
 *             required:
 *               - alertFrequency
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     topics:
 *                       type: array
 *                       items:
 *                         type: string
 *                     sources:
 *                       type: string
 *                     alertFrequency:
 *                       type: string
 *                     notifyOnNewStories:
 *                       type: boolean
 *       400:
 *         description: Missing or invalid required fields
 *       401:
 *         description: Token is missing or invalid
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/preferences", authenticate, setUserPreferences);

/**
 * @swagger
 * /api/users/preferences:
 *   get:
 *     tags: [Preferences]
 *     summary: Get user preferences
 *     description: Retrieve the current user's preferences from onboarding quiz
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     topics:
 *                       type: array
 *                       items:
 *                         type: string
 *                     sources:
 *                       type: array
 *                       items:
 *                         type: string
 *                     alertFrequency:
 *                       type: string
 *                       enum: [hourly, daily, weekly, monthly, never]
 *                     notifyOnNewStories:
 *                       type: boolean
 *       401:
 *         description: Token is missing or invalid
 *       404:
 *         description: User not found or preferences not set
 *       500:
 *         description: Internal server error
 */
router.get("/preferences", authenticate, getUserPreferences);

/**
 * @swagger
 * /api/users/engagement:
 *   post:
 *     tags: [Engagement]
 *     summary: Update user first week engagement based on interaction
 *     description: Save user's first week article views, article favs, articles ratings and topic clicks
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                action:
 *                  type: string
 *                  description: Interaction performed
 *     responses:
 *       200:
 *         description: Interactions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *       400:
 *         description: Missing or invalid required fields
 *       401:
 *         description: Token is missing or invalid
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/engagement", authenticate, updateFirstWeekEngagement);

/**
 * @swagger
 * /api/users/signup-date:
 *   get:
 *     summary: Retrieve sign up date for logged-in user
 *     tags: [Signup]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved sign up date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                   signupDate:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp when the user signed up.
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/signup-date", authenticate, getSignupDate);

export default router;
