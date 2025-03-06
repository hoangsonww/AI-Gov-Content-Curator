import { Request, Response } from "express";
import Article from "../models/article.model";

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
 *         source:
 *           type: string
 *         fetchedAt:
 *           type: string
 *           format: date-time
 */

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, source } = req.query;
    const filter: any = {};
    if (source) {
      filter.source = source;
    }
    const articles = await Article.find(filter)
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

export const getArticleById = async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch article" });
  }
};
