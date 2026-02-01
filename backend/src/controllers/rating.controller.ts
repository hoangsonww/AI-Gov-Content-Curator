import { Request, Response } from "express";
import Rating from "../models/rating.model";
import Article from "../models/article.model";
import mongoose from "mongoose";

/**
 * Create or update a rating for an article
 */
export const createOrUpdateRating = async (req: Request, res: Response) => {
  try {
    const {
      articleId,
      value,
      ratingType = "meter",
      comment,
      sessionId,
    } = req.body;
    const userId = (req as any).user?.id;

    // Validate article exists
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // Determine the identifier (userId or sessionId)
    const identifier = userId ? { userId } : { sessionId };
    if (!userId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Either userId or sessionId is required",
      });
    }

    // Find existing rating or create new one
    const existingRating = await Rating.findOne({
      articleId,
      ...identifier,
    });

    if (existingRating) {
      // Update existing rating
      existingRating.value = value;
      existingRating.ratingType = ratingType;
      existingRating.comment = comment;
      await existingRating.save();

      return res.status(200).json({
        success: true,
        message: "Rating updated successfully",
        data: existingRating,
      });
    } else {
      // Create new rating
      const newRating = new Rating({
        articleId,
        value,
        ratingType,
        comment,
        ...identifier,
      });

      await newRating.save();

      return res.status(201).json({
        success: true,
        message: "Rating created successfully",
        data: newRating,
      });
    }
  } catch (error: any) {
    console.error("Error creating/updating rating:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating/updating rating",
      error: error.message,
    });
  }
};

/**
 * Get rating for a specific article by user/session
 */
export const getUserRating = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const { sessionId } = req.query;
    const userId = (req as any).user?.id;

    const identifier = userId ? { userId } : { sessionId };

    const rating = await Rating.findOne({
      articleId,
      ...identifier,
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (error: any) {
    console.error("Error fetching user rating:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching rating",
      error: error.message,
    });
  }
};

/**
 * Get all ratings for an article
 */
export const getArticleRatings = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const ratings = await Rating.find({ articleId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Rating.countDocuments({ articleId });

    return res.status(200).json({
      success: true,
      data: {
        ratings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching article ratings:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching ratings",
      error: error.message,
    });
  }
};

/**
 * Get rating statistics for an article
 */
export const getArticleRatingStats = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;

    const stats = await Rating.aggregate([
      {
        $match: {
          articleId: new mongoose.Types.ObjectId(articleId),
        },
      },
      {
        $group: {
          _id: "$articleId",
          averageRating: { $avg: "$value" },
          averageMeterRating: {
            $avg: {
              $cond: [{ $eq: ["$ratingType", "meter"] }, "$value", null],
            },
          },
          averageStarRating: {
            $avg: {
              $cond: [{ $eq: ["$ratingType", "stars"] }, "$value", null],
            },
          },
          totalRatings: { $sum: 1 },
          meterRatings: {
            $sum: {
              $cond: [{ $eq: ["$ratingType", "meter"] }, 1, 0],
            },
          },
          starRatings: {
            $sum: {
              $cond: [{ $eq: ["$ratingType", "stars"] }, 1, 0],
            },
          },
          distribution: {
            $push: {
              value: "$value",
              type: "$ratingType",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          articleId: "$_id",
          averageRating: { $round: ["$averageRating", 2] },
          averageMeterRating: { $round: ["$averageMeterRating", 2] },
          averageStarRating: { $round: ["$averageStarRating", 2] },
          totalRatings: 1,
          meterRatings: 1,
          starRatings: 1,
          distribution: 1,
        },
      },
    ]);

    if (stats.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          articleId,
          averageRating: 0,
          averageMeterRating: 0,
          averageStarRating: 0,
          totalRatings: 0,
          meterRatings: 0,
          starRatings: 0,
          distribution: [],
        },
      });
    }

    // Process distribution for better visualization
    const processedStats = stats[0];
    const meterDistribution: { [key: string]: number } = {};
    const starDistribution: { [key: number]: number } = {};

    processedStats.distribution.forEach((rating: any) => {
      if (rating.type === "stars") {
        starDistribution[rating.value] =
          (starDistribution[rating.value] || 0) + 1;
      } else {
        // Group meter ratings into ranges
        const range = Math.floor(rating.value / 20) * 20;
        const key = `${range} to ${range + 20}`;
        meterDistribution[key] = (meterDistribution[key] || 0) + 1;
      }
    });

    processedStats.meterDistribution = meterDistribution;
    processedStats.starDistribution = starDistribution;
    delete processedStats.distribution;

    if (processedStats.totalRatings > 0) {
      if (
        processedStats.starRatings === 0 &&
        (processedStats.averageMeterRating === null ||
          typeof processedStats.averageMeterRating === "undefined")
      ) {
        processedStats.averageMeterRating = processedStats.averageRating;
        if (processedStats.meterRatings === 0) {
          processedStats.meterRatings = processedStats.totalRatings;
        }
      }
      if (
        processedStats.starRatings > 0 &&
        (processedStats.averageStarRating === null ||
          typeof processedStats.averageStarRating === "undefined")
      ) {
        processedStats.averageStarRating = processedStats.averageRating;
      }
    }

    return res.status(200).json({
      success: true,
      data: processedStats,
    });
  } catch (error: any) {
    console.error("Error fetching rating statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching rating statistics",
      error: error.message,
    });
  }
};

/**
 * Delete a rating
 */
export const deleteRating = async (req: Request, res: Response) => {
  try {
    const { ratingId } = req.params;
    const userId = (req as any).user?.id;
    const { sessionId } = req.body;

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    // Check ownership
    const isOwner =
      (userId && rating.userId?.toString() === userId) ||
      (sessionId && rating.sessionId === sessionId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this rating",
      });
    }

    await rating.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting rating:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting rating",
      error: error.message,
    });
  }
};

/**
 * Get aggregated ratings for multiple articles
 */
export const getBulkArticleRatings = async (req: Request, res: Response) => {
  try {
    const { articleIds } = req.body;

    if (!articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({
        success: false,
        message: "articleIds array is required",
      });
    }

    const objectIds = articleIds.map((id) => new mongoose.Types.ObjectId(id));

    const ratings = await Rating.aggregate([
      {
        $match: {
          articleId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$articleId",
          averageRating: { $avg: "$value" },
          totalRatings: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          articleId: "$_id",
          averageRating: { $round: ["$averageRating", 2] },
          totalRatings: 1,
        },
      },
    ]);

    // Create a map for easy lookup
    const ratingsMap: { [key: string]: any } = {};
    ratings.forEach((rating) => {
      ratingsMap[rating.articleId.toString()] = rating;
    });

    // Ensure all requested articles are in the response
    const result = articleIds.map((id) => {
      return (
        ratingsMap[id] || {
          articleId: id,
          averageRating: 0,
          totalRatings: 0,
        }
      );
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching bulk ratings:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching bulk ratings",
      error: error.message,
    });
  }
};
