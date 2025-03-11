import { Router } from "express";
import {
  getArticles,
  getArticleById,
  getArticleCount,
} from "../controllers/article.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Articles
 *   description: API endpoints for managing articles
 */

/**
 * @swagger
 * /api/articles:
 *   get:
 *     tags: [Articles]
 *     summary: Retrieve a list of articles
 *     description: Retrieve articles with optional pagination.
 *     parameters:
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
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *         description: Filter articles by source.
 *     responses:
 *       200:
 *         description: A list of articles.
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
 *                   description: Total number of articles available.
 *       500:
 *         description: Failed to fetch articles.
 */
router.get("/", getArticles);

/**
 * @swagger
 * /api/articles/count:
 *   get:
 *     tags: [Articles]
 *     summary: Retrieve the total number of articles
 *     responses:
 *       200:
 *         description: Total number of articles.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of articles in the database.
 *       500:
 *         description: Failed to fetch article count.
 */
router.get("/count", getArticleCount);

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     tags: [Articles]
 *     summary: Retrieve a single article by ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The article ID.
 *     responses:
 *       200:
 *         description: An article object.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: Unique identifier of the article.
 *                 url:
 *                   type: string
 *                   description: The original URL of the article.
 *                 title:
 *                   type: string
 *                   description: The title of the article.
 *                 content:
 *                   type: string
 *                   description: The full content of the article.
 *                 summary:
 *                   type: string
 *                   description: A short summary of the article.
 *                 source:
 *                   type: string
 *                   description: The source or publisher of the article.
 *                 fetchedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the article was fetched.
 *       404:
 *         description: Article not found.
 *       500:
 *         description: Failed to fetch article.
 */
router.get("/:id", getArticleById);

export default router;
