import { Request, Response } from "express";
import { processArticleNotifications, processDailyDigestNotifications } from "../services/notification.service";
import Article from "../models/article.model";

/**
 * Processes notifications for a newly ingested article
 */
export const processNotifications = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({ error: "Article ID is required" });
    }

    // Get the article
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Process notifications for this article
    await processArticleNotifications(article);

    res.status(200).json({ message: "Notifications processed successfully" });
  } catch (error: any) {
    console.error("Error processing notifications:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Processes notifications for articles by URL (used by crawler)
 */
export const processNotificationsByUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "Article URL is required" });
    }

    // Get the article by URL
    const article = await Article.findOne({ url });
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    // Process notifications for this article
    await processArticleNotifications(article);

    res.status(200).json({ message: "Notifications processed successfully" });
  } catch (error: any) {
    console.error("Error processing notifications by URL:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Processes daily digest notifications (called by cron job)
 */
export const processDailyDigest = async (req: Request, res: Response) => {
  try {
    await processDailyDigestNotifications();
    res.status(200).json({ message: "Daily digest notifications processed successfully" });
  } catch (error: any) {
    console.error("Error processing daily digest:", error);
    res.status(500).json({ error: error.message });
  }
};