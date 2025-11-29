import { Router } from "express";
import {
  getArticles,
  getArticleById,
  getArticleCount,
  searchArticles,
  getAllTopics,
  getAllLanguages,
  getArticlesByTopic,
  getSimilarArticles,
} from "../controllers/article.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Articles
 *     description: API endpoints for managing articles
 */

/**
 * @swagger
 * /api/articles:
 *   get:
 *     tags: [Articles]
 *     summary: Retrieve a list of articles
 *     security:
 *       - ApiKeyAuth: []
 *     description: Retrieve articles with optional pagination and filtering.
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
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter articles by a topic (comma-separated values allowed).
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *         description: Filter articles by language code (e.g., 'eng', 'spa', 'fra').
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
 *                       topics:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: List of topics associated with the article.
 *                       summary:
 *                         type: string
 *                         description: A short summary of the article (English translation for non-English articles).
 *                       summaryOriginal:
 *                         type: string
 *                         description: Summary in the original language of the article.
 *                       summaryTranslated:
 *                         type: string
 *                         description: Summary translated to English.
 *                       language:
 *                         type: string
 *                         description: ISO 639-3 language code of the original article.
 *                       languageName:
 *                         type: string
 *                         description: Human-readable language name.
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
 *     security:
 *       - ApiKeyAuth: []
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
 * /api/articles/search:
 *   get:
 *     tags: [Articles]
 *     security:
 *       - ApiKeyAuth: []
 *     summary: Search for articles by title or summary
 *     description: Retrieve articles that match the search query in either the title or summary fields.
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
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *         description: Filter articles by language code (e.g., 'eng', 'spa', 'fra').
 *     responses:
 *       200:
 *         description: A list of articles matching the search criteria.
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
 *                       summaryOriginal:
 *                         type: string
 *                         description: Summary in the original language.
 *                       summaryTranslated:
 *                         type: string
 *                         description: Summary translated to English.
 *                       language:
 *                         type: string
 *                         description: ISO 639-3 language code.
 *                       languageName:
 *                         type: string
 *                         description: Human-readable language name.
 *                       source:
 *                         type: string
 *                         description: The source or publisher of the article.
 *                       fetchedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp when the article was fetched.
 *                 total:
 *                   type: integer
 *                   description: Total number of articles matching the search criteria.
 *       500:
 *         description: Failed to search articles.
 */
router.get("/search", searchArticles);

/**
 * @swagger
 * /api/articles/topics:
 *   get:
 *     tags: [Articles]
 *     security:
 *       - ApiKeyAuth: []
 *     summary: Retrieve a paginated list of distinct topics across all articles
 *     description: Returns a paginated list of unique topics generated by AI from the articles in the database, with optional search filtering.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query to filter topics.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of topics per page.
 *     responses:
 *       200:
 *         description: A paginated list of distinct topics.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                 total:
 *                   type: integer
 *                   description: Total number of topics matching the search criteria.
 *                 page:
 *                   type: integer
 *                   description: Current page number.
 *                 limit:
 *                   type: integer
 *                   description: Number of topics per page.
 *       500:
 *         description: Failed to fetch topics.
 */
router.get("/topics", getAllTopics);

/**
 * @swagger
 * /api/articles/languages:
 *   get:
 *     tags: [Articles]
 *     security:
 *       - ApiKeyAuth: []
 *     summary: Retrieve a list of distinct languages across all articles
 *     description: Returns a list of unique languages with article counts.
 *     responses:
 *       200:
 *         description: A list of distinct languages with counts.
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
 *                       code:
 *                         type: string
 *                         description: ISO 639-3 language code.
 *                       name:
 *                         type: string
 *                         description: Human-readable language name.
 *                       count:
 *                         type: integer
 *                         description: Number of articles in this language.
 *                 total:
 *                   type: integer
 *                   description: Total number of distinct languages.
 *       500:
 *         description: Failed to fetch languages.
 */
router.get("/languages", getAllLanguages);

/**
 * @swagger
 * /api/articles/topic/{topic}:
 *   get:
 *     tags: [Articles]
 *     security:
 *       - ApiKeyAuth: []
 *     summary: Retrieve a list of articles filtered by topic
 *     description: Retrieve articles that include the specified topic (exact, case-insensitive match).
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *         description: The topic to filter articles by.
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
 *         description: A list of articles filtered by topic.
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
 *                   description: Total number of articles filtered by the topic.
 *       500:
 *         description: Failed to fetch articles by topic.
 */
router.get("/topic/:topic", getArticlesByTopic);

/**
 * @swagger
 * /api/articles/{id}/similar:
 *   get:
 *     tags: [Articles]
 *     summary: Get similar articles based on vector similarity
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The article ID to find similar articles for.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Number of similar articles to return.
 *     responses:
 *       200:
 *         description: A list of similar articles.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Article not found.
 *       500:
 *         description: Failed to fetch similar articles.
 */
router.get("/:id/similar", getSimilarArticles);

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     tags: [Articles]
 *     summary: Retrieve a single article by ID.
 *     security:
 *       - ApiKeyAuth: []
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
 *                 topics:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of topics associated with the article.
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
