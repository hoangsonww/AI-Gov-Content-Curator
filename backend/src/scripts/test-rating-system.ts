import mongoose from "mongoose";
import dotenv from "dotenv";
import Rating from "../models/rating.model";
import Article from "../models/article.model";

dotenv.config();

/**
 * Test script for the rating system
 * Run with: npx ts-node src/scripts/test-rating-system.ts
 */

async function testRatingSystem() {
  try {
    // Connect to MongoDB
    const MONGO_URI =
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mydb";
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get a sample article
    const article = await Article.findOne().limit(1);
    if (!article) {
      console.log("❌ No articles found in database");
      return;
    }

    console.log(`\n📄 Testing with article: ${article.title}`);
    console.log(`   Article ID: ${article._id}`);

    // Test 1: Create a meter rating
    console.log("\n🧪 Test 1: Creating a meter rating");
    const meterRating = new Rating({
      articleId: article._id,
      value: 75,
      ratingType: "meter",
      sessionId: "test-session-123",
      comment: "Great article, very informative!",
    });

    await meterRating.save();
    console.log("✅ Meter rating created successfully");
    console.log(`   Value: ${meterRating.value}/100`);

    // Test 2: Create a star rating
    console.log("\n🧪 Test 2: Creating a star rating");
    const starRating = new Rating({
      articleId: article._id,
      value: 4,
      ratingType: "stars",
      sessionId: "test-session-456",
      comment: "Good read",
    });

    await starRating.save();
    console.log("✅ Star rating created successfully");
    console.log(`   Value: ${starRating.value}/5 stars`);

    // Test 3: Test validation (invalid meter rating)
    console.log("\n🧪 Test 3: Testing validation (invalid meter rating)");
    try {
      const invalidRating = new Rating({
        articleId: article._id,
        value: 150, // Invalid: exceeds 100
        ratingType: "meter",
        sessionId: "test-session-789",
      });
      await invalidRating.save();
      console.log("❌ Validation failed - invalid rating was saved");
    } catch (error: any) {
      console.log("✅ Validation worked - invalid rating rejected");
      console.log(`   Error: ${error.message}`);
    }

    // Test 4: Get rating statistics
    console.log("\n🧪 Test 4: Getting rating statistics");
    const stats = await Rating.aggregate([
      {
        $match: {
          articleId: article._id,
        },
      },
      {
        $group: {
          _id: "$articleId",
          averageRating: { $avg: "$value" },
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
        },
      },
    ]);

    if (stats.length > 0) {
      console.log("✅ Statistics retrieved successfully");
      console.log(`   Total ratings: ${stats[0].totalRatings}`);
      console.log(`   Meter ratings: ${stats[0].meterRatings}`);
      console.log(`   Star ratings: ${stats[0].starRatings}`);
      console.log(`   Average rating: ${stats[0].averageRating.toFixed(2)}`);
    }

    // Test 5: Update existing rating
    console.log("\n🧪 Test 5: Updating existing rating");
    const existingRating = await Rating.findOne({
      articleId: article._id,
      sessionId: "test-session-123",
    });

    if (existingRating) {
      existingRating.value = 85;
      existingRating.comment = "Updated: Even better than I thought!";
      await existingRating.save();
      console.log("✅ Rating updated successfully");
      console.log(`   New value: ${existingRating.value}`);
    }

    // Test 6: Test unique constraint
    console.log("\n🧪 Test 6: Testing unique constraint (duplicate rating)");
    try {
      const duplicateRating = new Rating({
        articleId: article._id,
        value: 50,
        ratingType: "meter",
        sessionId: "test-session-123", // Same session as before
      });
      await duplicateRating.save();
      console.log("❌ Unique constraint failed - duplicate rating was saved");
    } catch (error: any) {
      console.log("✅ Unique constraint worked - duplicate rating rejected");
      console.log(
        `   Error: ${error.code === 11000 ? "Duplicate key error" : error.message}`,
      );
    }

    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await Rating.deleteMany({
      sessionId: {
        $in: ["test-session-123", "test-session-456", "test-session-789"],
      },
    });
    console.log("✅ Test data cleaned up");

    console.log("\n✨ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

// Run the test
testRatingSystem();
