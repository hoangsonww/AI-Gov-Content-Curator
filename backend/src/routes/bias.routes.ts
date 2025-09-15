import { Router } from "express";
import { biasAnalysisController } from "../controllers/biasAnalysis.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Bias Analysis
 *     description: API endpoints for analyzing article political bias and leaning
 */

/**
 * @swagger
 * /api/bias/analyze:
 *   post:
 *     tags: [Bias Analysis]
 *     summary: Analyze an article for political bias
 *     security:
 *       - ApiKeyAuth: []
 *     description: Analyze article content to determine political leaning, bias indicators, and neutrality score
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the article
 *                 example: "New Infrastructure Bill Passes Senate"
 *               content:
 *                 type: string
 *                 description: The full content of the article (min 100 chars, max 50000 chars)
 *                 example: "The Senate approved a landmark infrastructure bill today..."
 *     responses:
 *       200:
 *         description: Bias analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: The article title analyzed
 *                     contentLength:
 *                       type: integer
 *                       description: Length of the content analyzed
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         politicalLeaning:
 *                           type: object
 *                           properties:
 *                             position:
 *                               type: string
 *                               enum: [far-left, left, center-left, center, center-right, right, far-right]
 *                               description: Political position classification
 *                             score:
 *                               type: number
 *                               minimum: -100
 *                               maximum: 100
 *                               description: Numerical score from -100 (far-left) to +100 (far-right)
 *                             explanation:
 *                               type: string
 *                               description: Explanation of the position determination
 *                         confidence:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                           description: Confidence percentage in the assessment
 *                         isBiased:
 *                           type: boolean
 *                           description: Whether the article shows significant bias
 *                         biasIndicators:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Specific phrases or patterns indicating bias
 *                         neutralityScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                           description: Neutrality score where 100 is perfectly neutral
 *                         recommendation:
 *                           type: string
 *                           description: Suggestion for making content more balanced
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: When the analysis was performed
 *                 message:
 *                   type: string
 *                   example: "Bias analysis completed successfully"
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Title and content are required"
 *                 message:
 *                   type: string
 *                   example: "Please provide both article title and content for analysis"
 *       503:
 *         description: Service temporarily unavailable
 *       500:
 *         description: Internal server error
 */
router.post(
  "/analyze",
  biasAnalysisController.analyzeArticle.bind(biasAnalysisController),
);

/**
 * @swagger
 * /api/bias/analyze-batch:
 *   post:
 *     tags: [Bias Analysis]
 *     summary: Analyze multiple articles for political bias
 *     security:
 *       - ApiKeyAuth: []
 *     description: Batch analyze up to 10 articles for political leaning and bias
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articles
 *             properties:
 *               articles:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required:
 *                     - title
 *                     - content
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: The title of the article
 *                     content:
 *                       type: string
 *                       description: The full content of the article
 *     responses:
 *       200:
 *         description: Batch analysis completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalArticles:
 *                       type: integer
 *                       description: Total number of articles submitted
 *                     successfulAnalyses:
 *                       type: integer
 *                       description: Number of successfully analyzed articles
 *                     failedAnalyses:
 *                       type: integer
 *                       description: Number of failed analyses
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           success:
 *                             type: boolean
 *                           title:
 *                             type: string
 *                           analysis:
 *                             type: object
 *                             description: Same structure as single analysis response
 *                           error:
 *                             type: string
 *                             description: Error message if analysis failed
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Batch analysis completed: 8 succeeded, 2 failed"
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
router.post(
  "/analyze-batch",
  biasAnalysisController.analyzeBatch.bind(biasAnalysisController),
);

export default router;
