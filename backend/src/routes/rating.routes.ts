import { Router } from "express";
import {
  createOrUpdateRating,
  getUserRating,
  getArticleRatings,
  getArticleRatingStats,
  deleteRating,
  getBulkArticleRatings,
} from "../controllers/rating.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Ratings
 *     description: API endpoints for managing article ratings
 */

/**
 * @swagger
 * /api/ratings:
 *   post:
 *     tags: [Ratings]
 *     summary: Create or update a rating for an article
 *     security:
 *       - ApiKeyAuth: []
 *     description: Create a new rating or update an existing rating for an article.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleId
 *               - value
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to rate
 *               value:
 *                 type: number
 *                 description: Rating value (-100 to 100 for meter, 1-5 for stars)
 *               ratingType:
 *                 type: string
 *                 enum: [meter, stars]
 *                 default: meter
 *                 description: Type of rating system
 *               comment:
 *                 type: string
 *                 description: Optional comment with the rating
 *               sessionId:
 *                 type: string
 *                 description: Session ID for anonymous users (required if not authenticated)
 *     responses:
 *       201:
 *         description: Rating created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       200:
 *         description: Rating updated successfully
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Article not found
 *       500:
 *         description: Internal server error
 */
router.post("/", createOrUpdateRating);

/**
 * @swagger
 * /api/ratings/article/{articleId}/user:
 *   get:
 *     tags: [Ratings]
 *     summary: Get user's rating for a specific article
 *     security:
 *       - ApiKeyAuth: []
 *     description: Retrieve the current user's or session's rating for an article.
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the article
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *         description: Session ID for anonymous users
 *     responses:
 *       200:
 *         description: Rating retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       404:
 *         description: Rating not found
 *       500:
 *         description: Internal server error
 */
router.get("/article/:articleId/user", getUserRating);

/**
 * @swagger
 * /api/ratings/article/{articleId}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get all ratings for an article
 *     security:
 *       - ApiKeyAuth: []
 *     description: Retrieve all ratings for a specific article with pagination.
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the article
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of ratings per page
 *     responses:
 *       200:
 *         description: Ratings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ratings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Rating'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/article/:articleId", getArticleRatings);

/**
 * @swagger
 * /api/ratings/article/{articleId}/stats:
 *   get:
 *     tags: [Ratings]
 *     summary: Get rating statistics for an article
 *     security:
 *       - ApiKeyAuth: []
 *     description: Retrieve aggregated rating statistics for a specific article.
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the article
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RatingStats'
 *       500:
 *         description: Internal server error
 */
router.get("/article/:articleId/stats", getArticleRatingStats);

/**
 * @swagger
 * /api/ratings/bulk:
 *   post:
 *     tags: [Ratings]
 *     summary: Get ratings for multiple articles
 *     security:
 *       - ApiKeyAuth: []
 *     description: Retrieve aggregated ratings for multiple articles at once.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleIds
 *             properties:
 *               articleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of article IDs
 *     responses:
 *       200:
 *         description: Bulk ratings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       articleId:
 *                         type: string
 *                       averageRating:
 *                         type: number
 *                       totalRatings:
 *                         type: integer
 *       400:
 *         description: Bad request - invalid input
 *       500:
 *         description: Internal server error
 */
router.post("/bulk", getBulkArticleRatings);

/**
 * @swagger
 * /api/ratings/{ratingId}:
 *   delete:
 *     tags: [Ratings]
 *     summary: Delete a rating
 *     security:
 *       - ApiKeyAuth: []
 *     description: Delete a specific rating (only the owner can delete their rating).
 *     parameters:
 *       - in: path
 *         name: ratingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the rating to delete
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session ID for anonymous users
 *     responses:
 *       200:
 *         description: Rating deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Forbidden - user doesn't own this rating
 *       404:
 *         description: Rating not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:ratingId", deleteRating);

export default router;
