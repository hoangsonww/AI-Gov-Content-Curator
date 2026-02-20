const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Article = require('../models/article.model').default;

// 2. The function to be tested
async function updateArticlesWithScore() {
  const articles = await Article.find();
  for (const article of articles) {
    // Logic to calculate/assign a score
    article.sourceScore = Math.floor(Math.random() * 100);
    await article.save();
  }
}

// 3. Jest Test Suite
describe('Article Database Seeding and Updating', () => {
  let mongoServer;

  const mockArticles = Array.from({ length: 10 }, (_, i) => ({
    url: `http://example.com/${i + 1}`,
    title: `Article ${i + 1}`,
    content: "Test content",
    summary: `Summary for article ${i + 1}`,
    topics: ["topic-a", "topic-b"],
    source: "Test source",
    fetchedAt: new Date(),
  }));

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should seed the database and update with sourceScore', async () => {
    // SEED: Insert the 10 mock samples
    await Article.insertMany(mockArticles);
    
    // VERIFY SEED: Ensure 10 items exist
    const initialCount = await Article.countDocuments();
    expect(initialCount).toBe(10);

    // RUN FUNCTION: Add the sourceScore field
    await updateArticlesWithScore();

    // VERIFY UPDATE: Check that all documents now have sourceScore
    const updatedArticles = await Article.find();
    updatedArticles.forEach(article => {
      expect(article.sourceScore).toBeDefined();
      expect(typeof article.sourceScore).toBe('number');
    });
  });
});
