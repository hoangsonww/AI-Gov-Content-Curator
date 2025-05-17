import { Request, Response } from "express";
import Article from "../models/article.model";
import { PipelineStage } from "mongoose";

/**
 * @swagger
 * components:
 *   schemas:
 *     Article:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         url:
 *           type: string
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         summary:
 *           type: string
 *         topics:
 *           type: array
 *           items:
 *             type: string
 *         source:
 *           type: string
 *         fetchedAt:
 *           type: string
 *           format: date-time
 */

/**
 * Get a list of articles with optional pagination and filtering by source and topic.
 *
 * @param req The request object containing query parameters for pagination and filtering.
 * @param res The response object to send the list of articles or an error message.
 */
export const getArticles = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, source, topic } = req.query;
    const filter: any = {};

    if (source) {
      filter.source = source;
    }

    if (topic) {
      // Support comma-separated list of topics
      const topicsArray =
        typeof topic === "string"
          ? topic.split(",").map((t) => t.trim())
          : topic;
      filter.topics = { $in: topicsArray };
    }

    const articles = await Article.find(filter)
      // Exclude the full content to speed up responses if desired.
      .select("-content")
      .sort({ fetchedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const count = await Article.countDocuments(filter);
    res.json({ data: articles, total: count });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch articles" });
  }
};

/**
 * Get a single article by its ID.
 *
 * @param req The request object containing the article ID in the URL parameters.
 * @param res The response object to send the article or an error message.
 */
export const getArticleById = async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(article);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
};

/**
 * Get the total count of articles in the database.
 *
 * @param req The request object.
 * @param res The response object to send the total count or an error message.
 */
export const getArticleCount = async (req: Request, res: Response) => {
  try {
    const count = await Article.countDocuments();
    res.json({ total: count });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch article count" });
  }
};

/**
 * Search for articles by title or summary with optional pagination.
 *
 * @param req The request object containing the search query and pagination parameters.
 * @param res The response object to send the search results or an error message.
 */
export const searchArticles = async (req: Request, res: Response) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const filter: any = {};

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
        // Optionally, search in topics as well
        { topics: { $regex: q, $options: "i" } },
      ];
    }

    const articles = await Article.find(filter)
      .select("-content")
      .sort({ fetchedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const count = await Article.countDocuments(filter);
    res.json({ data: articles, total: count });
  } catch (error) {
    res.status(500).json({ error: "Failed to search articles" });
  }
};

/**
 * Get a list of all distinct topics across all articles.
 *
 * @param req The request object.
 * @param res The response object to send the distinct topics.
 */
export const getAllTopics = async (req: Request, res: Response) => {
  try {
    // Fetch distinct topics from the Article collection.
    const topics = await Article.distinct("topics");
    res.json({ data: topics });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

/**
 * Get a list of articles filtered by a specific topic.
 *
 * The function uses an aggregation pipeline to normalize each article’s topics by
 * converting them to lowercase and removing spaces. Then, it matches articles where
 * the normalized topics array contains the provided topic (also normalized).
 *
 * @param req The request object with:
 *   - req.params.topic: the topic string (e.g., "AmericaFirstPriorities")
 *   - req.query.page: page number (optional, default: 1)
 *   - req.query.limit: number of articles per page (optional, default: 10)
 * @param res The response object.
 */
export const getArticlesByTopic = async (req: Request, res: Response) => {
  try {
    const { topic } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Normalize the provided topic: lower-case and remove spaces.
    const normalizedTopic = topic.toLowerCase().replace(/\s+/g, "");

    // Build the aggregation pipeline with explicit typing.
    const pipeline: PipelineStage[] = [
      {
        $addFields: {
          normalizedTopics: {
            $map: {
              input: "$topics",
              as: "t",
              in: {
                $toLower: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: "$$t",
                        find: " ",
                        replacement: "",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          normalizedTopics: { $in: [normalizedTopic] },
        },
      },
      {
        // Cast -1 as a literal of type 1 | -1
        $sort: { fetchedAt: -1 as 1 | -1 },
      },
      {
        $skip: (Number(page) - 1) * Number(limit),
      },
      {
        $limit: Number(limit),
      },
    ];

    const articles = await Article.aggregate(pipeline);

    // Count using a similar pipeline
    const countPipeline: PipelineStage[] = [
      {
        $addFields: {
          normalizedTopics: {
            $map: {
              input: "$topics",
              as: "t",
              in: {
                $toLower: {
                  $trim: {
                    input: {
                      $replaceAll: {
                        input: "$$t",
                        find: " ",
                        replacement: "",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $match: {
          normalizedTopics: { $in: [normalizedTopic] },
        },
      },
      { $count: "total" },
    ];

    const countResult = await Article.aggregate(countPipeline);
    const total = countResult[0] ? countResult[0].total : 0;

    res.json({ data: articles, total });
  } catch (error) {
    console.error("Error fetching articles by topic:", error);
    res.status(500).json({ error: "Failed to fetch articles by topic" });
  }
};
