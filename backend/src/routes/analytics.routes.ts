import { Router } from "express";
import {
  getSourceDistribution,
  getTopicTrends,
  getBiasTrends,
  getTopRatedArticles,
  getAnalyticsInsights,
} from "../controllers/analytics.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Analytics
 *     description: Dashboard and trend analysis endpoints
 */

/**
 * @swagger
 * /api/analytics/source-distribution:
 *   get:
 *     tags: [Analytics]
 *     summary: Get article distribution by source
 *     description: Returns the count and percentage of articles from each source
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles from this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles until this date (ISO 8601)
 *     responses:
 *       200:
 *         description: Source distribution retrieved successfully
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
 *                       source:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       percentage:
 *                         type: string
 *                 total:
 *                   type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/source-distribution", getSourceDistribution);

/**
 * @swagger
 * /api/analytics/topic-trends:
 *   get:
 *     tags: [Analytics]
 *     summary: Get topic trends over time
 *     description: Returns the frequency of topics over time periods
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles from this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles until this date (ISO 8601)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Time interval for grouping trends
 *     responses:
 *       200:
 *         description: Topic trends retrieved successfully
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
 *                       topic:
 *                         type: string
 *                       data:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             period:
 *                               type: string
 *                             count:
 *                               type: integer
 *                       total:
 *                         type: integer
 *                 interval:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get("/topic-trends", getTopicTrends);

/**
 * @swagger
 * /api/analytics/bias-trends:
 *   get:
 *     tags: [Analytics]
 *     summary: Get bias trends by source
 *     description: Returns bias analysis trends across different sources
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles from this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter articles until this date (ISO 8601)
 *     responses:
 *       200:
 *         description: Bias trends retrieved successfully
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
 *                       source:
 *                         type: string
 *                       articles:
 *                         type: integer
 *                       biasScore:
 *                         type: number
 *                       biasLabel:
 *                         type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get("/bias-trends", getBiasTrends);

/**
 * @swagger
 * /api/analytics/top-rated:
 *   get:
 *     tags: [Analytics]
 *     summary: Get top-rated articles
 *     description: Returns articles with the highest average ratings
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of articles to return
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter ratings from this date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter ratings until this date (ISO 8601)
 *     responses:
 *       200:
 *         description: Top-rated articles retrieved successfully
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
 *                       article:
 *                         type: object
 *                       averageRating:
 *                         type: number
 *                       totalRatings:
 *                         type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/top-rated", getTopRatedArticles);

/**
 * @swagger
 * /api/analytics/insights:
 *   get:
 *     tags: [Analytics]
 *     summary: Get AI-generated insights about trends
 *     description: Returns AI-generated summary of article trends and patterns
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Insights generated successfully
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
 *                     summary:
 *                       type: string
 *                     stats:
 *                       type: object
 *                     aiGenerated:
 *                       type: boolean
 *       500:
 *         description: Internal server error
 */
router.get("/insights", getAnalyticsInsights);

export default router;
