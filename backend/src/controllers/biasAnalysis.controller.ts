import { Request, Response } from "express";
import {
  analyzeArticleBias,
  BiasAnalysisResult,
} from "../services/biasAnalysis.service";

/**
 * Controller for bias analysis endpoints
 */
export class BiasAnalysisController {
  /**
   * Analyze article for political bias
   * POST /api/bias/analyze
   */
  async analyzeArticle(req: Request, res: Response): Promise<void> {
    try {
      const { title, content } = req.body;

      // Validate input
      if (!title || !content) {
        res.status(400).json({
          success: false,
          error: "Title and content are required",
          message: "Please provide both article title and content for analysis",
        });
        return;
      }

      if (typeof title !== "string" || typeof content !== "string") {
        res.status(400).json({
          success: false,
          error: "Invalid input types",
          message: "Title and content must be strings",
        });
        return;
      }

      // Validate content length
      const MIN_CONTENT_LENGTH = 100;
      const MAX_CONTENT_LENGTH = 50000;

      if (content.length < MIN_CONTENT_LENGTH) {
        res.status(400).json({
          success: false,
          error: "Content too short",
          message: `Article content must be at least ${MIN_CONTENT_LENGTH} characters for meaningful analysis`,
        });
        return;
      }

      if (content.length > MAX_CONTENT_LENGTH) {
        res.status(400).json({
          success: false,
          error: "Content too long",
          message: `Article content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
        });
        return;
      }

      // Perform bias analysis
      const analysisResult: BiasAnalysisResult = await analyzeArticleBias(
        title,
        content,
      );

      // Send successful response
      res.status(200).json({
        success: true,
        data: {
          title,
          contentLength: content.length,
          analysis: analysisResult,
          timestamp: new Date().toISOString(),
        },
        message: "Bias analysis completed successfully",
      });
    } catch (error: any) {
      console.error("Error in bias analysis controller:", error);

      // Handle specific error types
      if (error.message?.includes("exhausted")) {
        res.status(503).json({
          success: false,
          error: "Service temporarily unavailable",
          message:
            "AI service is currently overloaded. Please try again later.",
        });
        return;
      }

      if (error.message?.includes("API_KEY")) {
        res.status(500).json({
          success: false,
          error: "Configuration error",
          message:
            "Service is not properly configured. Please contact support.",
        });
        return;
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: "Analysis failed",
        message:
          "An error occurred while analyzing the article. Please try again.",
      });
    }
  }

  /**
   * Batch analyze multiple articles
   * POST /api/bias/analyze-batch
   */
  async analyzeBatch(req: Request, res: Response): Promise<void> {
    try {
      const { articles } = req.body;

      // Validate input
      if (!articles || !Array.isArray(articles)) {
        res.status(400).json({
          success: false,
          error: "Invalid input",
          message: "Please provide an array of articles",
        });
        return;
      }

      const MAX_BATCH_SIZE = 10;
      if (articles.length > MAX_BATCH_SIZE) {
        res.status(400).json({
          success: false,
          error: "Batch too large",
          message: `Maximum batch size is ${MAX_BATCH_SIZE} articles`,
        });
        return;
      }

      // Validate each article
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        if (!article.title || !article.content) {
          res.status(400).json({
            success: false,
            error: "Invalid article format",
            message: `Article at index ${i} is missing title or content`,
          });
          return;
        }
      }

      // Process articles in parallel with error handling
      const results = await Promise.allSettled(
        articles.map((article) =>
          analyzeArticleBias(article.title, article.content),
        ),
      );

      // Format results
      const analyses = results.map((result, index) => {
        if (result.status === "fulfilled") {
          return {
            success: true,
            title: articles[index].title,
            analysis: result.value,
          };
        } else {
          return {
            success: false,
            title: articles[index].title,
            error: "Analysis failed for this article",
          };
        }
      });

      const successCount = analyses.filter((a) => a.success).length;
      const failureCount = analyses.filter((a) => !a.success).length;

      res.status(200).json({
        success: true,
        data: {
          totalArticles: articles.length,
          successfulAnalyses: successCount,
          failedAnalyses: failureCount,
          results: analyses,
          timestamp: new Date().toISOString(),
        },
        message: `Batch analysis completed: ${successCount} succeeded, ${failureCount} failed`,
      });
    } catch (error: any) {
      console.error("Error in batch bias analysis:", error);

      res.status(500).json({
        success: false,
        error: "Batch analysis failed",
        message:
          "An error occurred while processing the batch. Please try again.",
      });
    }
  }
}

// Export singleton instance
export const biasAnalysisController = new BiasAnalysisController();
