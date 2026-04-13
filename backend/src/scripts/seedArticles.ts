#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Article from "../models/article.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mydb";

const fakeArticles = [
  {
    url: "https://www.bbc.com/news/articles/c05dpr1m71go",
    title: "Global Climate Summit Reaches Historic Agreement on Carbon Emissions",
    content:
      "World leaders gathered in Geneva to discuss climate change initiatives. After three weeks of negotiations, over 190 countries agreed on a comprehensive framework to reduce carbon emissions by 50% by 2035. The agreement includes provisions for developing nations and renewable energy investments.",
    summary:
      "190 countries reach landmark climate agreement targeting 50% carbon emission reduction by 2035.",
    topics: ["Environment", "Politics", "Science"],
    source: "https://www.bbc.com/news/articles/c05dpr1m71go",
    fetchedAt: new Date("2026-04-01"),
  },
  {
    url: "https://www.cnn.com/article/ai-breakthrough-2026",
    title: "Artificial Intelligence Achieves New Milestone in Medical Diagnosis",
    content:
      "Researchers at leading institutions announced a major breakthrough in AI-assisted medical diagnosis. The new algorithm demonstrates 99.2% accuracy in detecting early-stage cancer, outperforming traditional methods. This development could revolutionize healthcare globally.",
    summary:
      "AI system achieves 99.2% accuracy in detecting early-stage cancer, set to transform medical diagnostics.",
    topics: ["Technology", "Health", "Science"],
    source: "https://www.cnn.com/article/ai-breakthrough-2026",
    fetchedAt: new Date("2026-04-02"),
  },
  {
    url: "https://www.theguardian.com/business/tech-sector",
    title: "Tech Industry Faces New Regulations on Data Privacy",
    content:
      "The European Union and United States announced synchronized regulations targeting major technology companies' data collection practices. The new framework requires explicit user consent for data usage and imposing significant fines for violations. Industry experts predict major restructuring of tech business models.",
    summary:
      "EU and US introduce strict data privacy regulations, requiring explicit user consent from tech companies.",
    topics: ["Technology", "Business", "Politics"],
    source: "https://www.theguardian.com/business/tech-sector",
    fetchedAt: new Date("2026-04-03"),
  },
  {
    url: "https://www.foxnews.com/politics/election-2026",
    title: "Major Political Developments in Mid-Term Elections Campaign",
    content:
      "As campaign season intensifies, political analysts highlight key issues dominating public discourse. Economic policy, healthcare reform, and infrastructure investment remain top priorities for voters across the nation. Polling shows a tight race with several months remaining.",
    summary:
      "Mid-term election campaigns highlight economy, healthcare, and infrastructure as key voter concerns.",
    topics: ["Politics", "Business"],
    source: "https://www.foxnews.com/politics/election-2026",
    fetchedAt: new Date("2026-04-04"),
  },
  {
    url: "https://www.apnews.com/health/pandemic-response",
    title: "Global Health Organization Launches Pandemic Preparedness Initiative",
    content:
      "The World Health Organization announced a comprehensive five-year plan to strengthen pandemic preparedness across developing nations. The initiative includes vaccine production facilities, early warning systems, and healthcare worker training. Initial funding of $10 billion has been committed.",
    summary:
      "WHO launches global pandemic preparedness initiative with $10 billion initial funding commitment.",
    topics: ["Health", "Politics", "Science"],
    source: "https://www.apnews.com/health/pandemic-response",
    fetchedAt: new Date("2026-04-05"),
  },
  {
    url: "https://www.bbc.com/future/sustainable-energy",
    title: "Renewable Energy Capacity Surpasses Fossil Fuels Globally",
    content:
      "For the first time in history, global renewable energy capacity has exceeded fossil fuel generation capacity. Solar and wind power now account for over 55% of global electricity generation. Energy experts attribute this shift to declining technology costs and environmental policy support.",
    summary:
      "Renewable energy capacity exceeds fossil fuels worldwide, marking major shift in global energy landscape.",
    topics: ["Environment", "Business", "Science"],
    source: "https://www.bbc.com/future/sustainable-energy",
    fetchedAt: new Date("2026-04-06"),
  },
  {
    url: "https://www.cnn.com/business/space-exploration",
    title: "Private Companies Launch First Commercial Space Station Module",
    content:
      "Following years of development, private aerospace companies successfully launched the first commercial module for a privately-operated space station. The module docked successfully with existing infrastructure. This milestone opens new possibilities for space tourism and research.",
    summary:
      "First private commercial space station module launched successfully, advancing space industry commercialization.",
    topics: ["Technology", "Business", "Science"],
    source: "https://www.cnn.com/business/space-exploration",
    fetchedAt: new Date("2026-04-07"),
  },
  {
    url: "https://www.bloomberg.com/markets/cryptocurrencies",
    title: "Central Banks Consider Digital Currency Standards",
    content:
      "Central banks from major economies are collaborating to develop standardized protocols for digital currencies. The initiative aims to create interoperability between different national digital currencies while maintaining regulatory oversight. Discussions focus on security, privacy, and financial stability.",
    summary:
      "Central banks work on digital currency standards to ensure interoperability and regulatory compliance.",
    topics: ["Business", "Technology", "Politics"],
    source: "https://www.bloomberg.com/markets/cryptocurrencies",
    fetchedAt: new Date("2026-04-08"),
  },
  {
    url: "https://www.nature.com/articles/quantum-computing",
    title: "Quantum Computing Breakthrough Solves Complex Optimization Problems",
    content:
      "Researchers demonstrated a quantum computer solving real-world optimization problems previously unsolvable with classical computers. Applications include drug discovery, materials science, and financial modeling. The breakthrough brings practical quantum computing applications closer to reality.",
    summary:
      "Quantum computers solve previously intractable optimization problems, advancing practical quantum applications.",
    topics: ["Science", "Technology"],
    source: "https://www.nature.com/articles/quantum-computing",
    fetchedAt: new Date("2026-04-09"),
  },
  {
    url: "https://www.reuters.com/business/agriculture",
    title: "Vertical Farming Technology Scales Up to Feed Cities Sustainably",
    content:
      "Vertical farming operations are expanding rapidly across major cities. Using controlled-environment agriculture and precision farming techniques, these facilities produce year-round crops while using 95% less water than traditional farming. Urban food security improves significantly.",
    summary:
      "Vertical farming expands in cities, achieving sustainable food production with 95% less water usage.",
    topics: ["Environment", "Business", "Technology"],
    source: "https://www.reuters.com/business/agriculture",
    fetchedAt: new Date("2026-04-10"),
  },
];

async function seedDatabase() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("📝 Clearing existing articles...");
    await Article.deleteMany({});

    console.log("📥 Inserting 10 fake articles...");
    const result = await Article.insertMany(fakeArticles);
    console.log(`✅ Successfully inserted ${result.length} articles`);

    console.log("\n📊 Articles Details:");
    result.forEach((article, index) => {
      console.log(
        `${index + 1}. ${article.title} (${article.topics.join(", ")})`
      );
    });

    console.log("\n✨ Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

seedDatabase();