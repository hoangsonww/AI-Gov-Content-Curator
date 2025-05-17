import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Article from "../models/article.model";
import { extractTopics } from "../services/topicExtractor.service";
import logger from "../utils/logger";

dotenv.config();
mongoose.set("strictQuery", false);

const MONGODB_URI = process.env.MONGODB_URI || "";
const BATCH_LIMIT = 20;
const DELAY_BETWEEN_UPDATES_MS = 500;
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Assign topics to existing articles in the database
 */
const assignTopicsToArticles = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info("Connected to MongoDB ✅");

    // Fetch ALL articles (remove filter so we override existing topics)
    const total = await Article.countDocuments({});
    logger.info(`Found ${total} total articles — will update all.`);

    let processed = 0;

    while (true) {
      const articles = await Article.find({}).limit(BATCH_LIMIT);

      if (articles.length === 0) break;

      for (const article of articles) {
        try {
          logger.info(`Extracting topics for article: ${article.title}`);
          const topics = await extractTopics(article.summary);
          article.topics = topics;
          await article.save();
          processed++;
          logger.info(`✅ Updated "${article.title}" → ${topics.join(", ")}`);
          await delay(DELAY_BETWEEN_UPDATES_MS);
        } catch (err) {
          logger.error(`❌ Failed updating "${article.title}":`, err);
        }
      }
    }

    logger.info(`🎉 Finished updating ${processed} articles.`);
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  } catch (err) {
    logger.error("Fatal error while assigning topics:", err);
    process.exit(1);
  }
};

// Run the script if executed directly
if (require.main === module) {
  assignTopicsToArticles().then(() => process.exit(0));
}
