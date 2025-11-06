import { Request, Response } from "express";
import Article from "../models/article.model";
import Rating from "../models/rating.model";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Controller for analytics and dashboard endpoints
 */

/**
 * Get source distribution statistics
 * GET /api/analytics/source-distribution
 */
export const getSourceDistribution = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.fetchedAt = {};
      if (startDate) filter.fetchedAt.$gte = new Date(startDate as string);
      if (endDate) filter.fetchedAt.$lte = new Date(endDate as string);
    }

    const distribution = await Article.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const total = distribution.reduce((sum, item) => sum + item.count, 0);
    const data = distribution.map((item) => ({
      source: item._id,
      count: item.count,
      percentage: ((item.count / total) * 100).toFixed(2),
    }));

    res.json({
      success: true,
      data,
      total,
    });
  } catch (error: any) {
    console.error("Error in getSourceDistribution:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch source distribution",
      message: error.message,
    });
  }
};

/**
 * Get topic trends over time
 * GET /api/analytics/topic-trends
 */
export const getTopicTrends = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, interval = "day" } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.fetchedAt = {};
      if (startDate) filter.fetchedAt.$gte = new Date(startDate as string);
      if (endDate) filter.fetchedAt.$lte = new Date(endDate as string);
    }

    // Get topic frequency by time period
    const dateFormat =
      interval === "week"
        ? { $dateToString: { format: "%Y-W%V", date: "$fetchedAt" } }
        : interval === "month"
          ? { $dateToString: { format: "%Y-%m", date: "$fetchedAt" } }
          : { $dateToString: { format: "%Y-%m-%d", date: "$fetchedAt" } };

    const trends = await Article.aggregate([
      { $match: filter },
      { $unwind: "$topics" },
      {
        $group: {
          _id: {
            period: dateFormat,
            topic: "$topics",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.period": 1, count: -1 } },
    ]);

    // Transform data for frontend consumption
    const topicMap = new Map<string, any[]>();
    trends.forEach((item) => {
      const topic = item._id.topic;
      if (!topicMap.has(topic)) {
        topicMap.set(topic, []);
      }
      topicMap.get(topic)!.push({
        period: item._id.period,
        count: item.count,
      });
    });

    const data = Array.from(topicMap.entries()).map(([topic, values]) => ({
      topic,
      data: values,
      total: values.reduce((sum, v) => sum + v.count, 0),
    }));

    // Sort by total count and limit to top topics
    data.sort((a, b) => b.total - a.total);
    const topTopics = data.slice(0, 10);

    res.json({
      success: true,
      data: topTopics,
      interval,
    });
  } catch (error: any) {
    console.error("Error in getTopicTrends:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch topic trends",
      message: error.message,
    });
  }
};

/**
 * Get bias trends (placeholder for future bias score integration)
 * GET /api/analytics/bias-trends
 */
export const getBiasTrends = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.fetchedAt = {};
      if (startDate) filter.fetchedAt.$gte = new Date(startDate as string);
      if (endDate) filter.fetchedAt.$lte = new Date(endDate as string);
    }

    // For now, we'll return a placeholder structure
    // In the future, this would integrate with the bias analysis service
    const biasBySource = await Article.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const data = biasBySource.map((item) => ({
      source: item._id,
      articles: item.count,
      // Placeholder values - would come from actual bias analysis
      biasScore: 0,
      biasLabel: "Neutral",
    }));

    res.json({
      success: true,
      data,
      message:
        "Bias analysis is available via /api/bias/analyze endpoint. Future integration will track bias scores per article.",
    });
  } catch (error: any) {
    console.error("Error in getBiasTrends:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bias trends",
      message: error.message,
    });
  }
};

/**
 * Get top-rated articles
 * GET /api/analytics/top-rated
 */
export const getTopRatedArticles = async (req: Request, res: Response) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const topRated = await Rating.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$articleId",
          averageRating: { $avg: "$value" },
          totalRatings: { $sum: 1 },
        },
      },
      { $match: { totalRatings: { $gte: 3 } } }, // At least 3 ratings
      { $sort: { averageRating: -1, totalRatings: -1 } },
      { $limit: Number(limit) },
    ]);

    // Populate article details
    const articleIds = topRated.map((item) => item._id);
    const articles = await Article.find({ _id: { $in: articleIds } }).select(
      "-content",
    );

    const articlesMap = new Map(articles.map((a) => [a._id.toString(), a]));

    const data = topRated
      .map((item) => {
        const article = articlesMap.get(item._id.toString());
        if (!article) return null;
        return {
          article: {
            _id: article._id,
            title: article.title,
            source: article.source,
            topics: article.topics,
            fetchedAt: article.fetchedAt,
            url: article.url,
          },
          averageRating: Number(item.averageRating.toFixed(2)),
          totalRatings: item.totalRatings,
        };
      })
      .filter((item) => item !== null);

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error in getTopRatedArticles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch top-rated articles",
      message: error.message,
    });
  }
};

/**
 * Get AI-generated insights about recent trends
 * GET /api/analytics/insights
 */
export const getAnalyticsInsights = async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    // Get recent articles statistics
    const recentArticles = await Article.aggregate([
      { $match: { fetchedAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalArticles: { $sum: 1 },
          sources: { $addToSet: "$source" },
          allTopics: { $push: "$topics" },
        },
      },
    ]);

    if (!recentArticles.length || recentArticles[0].totalArticles === 0) {
      return res.json({
        success: true,
        data: {
          summary:
            "No recent articles found in the specified time period. Please try a different date range.",
          totalArticles: 0,
          period: `Last ${days} days`,
        },
      });
    }

    // Flatten topics and count
    const topicsFlat = recentArticles[0].allTopics.flat();
    const topicCounts = topicsFlat.reduce(
      (acc: Record<string, number>, topic: string) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      },
      {},
    );

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([topic]) => topic);

    const stats = {
      totalArticles: recentArticles[0].totalArticles,
      sources: recentArticles[0].sources,
      topTopics,
      period: `Last ${days} days`,
    };

    // Generate AI insights if API key is available
    let aiSummary = null;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `As a government content analyst, provide a brief 2-3 sentence summary of these article trends:

Period: ${stats.period}
Total Articles: ${stats.totalArticles}
Sources: ${stats.sources.join(", ")}
Top Topics: ${topTopics.join(", ")}

Focus on identifying any notable patterns, emerging themes, or shifts in coverage. Be concise and insightful.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        aiSummary = response.text();
      } catch (aiError) {
        console.error("AI generation failed:", aiError);
        // Continue without AI summary
      }
    }

    res.json({
      success: true,
      data: {
        summary:
          aiSummary ||
          `In the ${stats.period.toLowerCase()}, ${stats.totalArticles} articles were published across ${stats.sources.length} sources, with primary focus on: ${topTopics.join(", ")}.`,
        stats,
        aiGenerated: !!aiSummary,
      },
    });
  } catch (error: any) {
    console.error("Error in getAnalyticsInsights:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate insights",
      message: error.message,
    });
  }
};
