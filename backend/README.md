# SynthoraAI - AI Article Content Curator Backend (work in progress)

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express.js-000?style=flat&logo=express&logoColor=white)](https://expressjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Mongoose](https://img.shields.io/badge/Mongoose-8D99AE?style=flat&logo=mongoose&logoColor=white)](https://mongoosejs.com)
[![Axios](https://img.shields.io/badge/Axios-%23007ACC.svg?style=flat&logo=axios&logoColor=white)](https://github.com/axios/axios)
[![Cheerio](https://img.shields.io/badge/Cheerio-%23E34F26.svg?style=flat&logo=cheerio&logoColor=white)](https://cheerio.js.org)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-%23FF5722.svg?style=flat&logo=puppeteer&logoColor=white)](https://pptr.dev)
[![Google Generative AI](https://img.shields.io/badge/Google%20Generative%20AI-4285F4?style=flat&logo=google&logoColor=white)](https://developers.generativeai.google)
[![Vercel](https://img.shields.io/badge/Vercel-000?style=flat&logo=vercel&logoColor=white)](https://vercel.com)
[![Cron](https://img.shields.io/badge/Cron-%232C3E50.svg?style=flat&logo=cron&logoColor=white)](https://en.wikipedia.org/wiki/Cron)

**Currently live at: [https://ai-content-curator-backend.vercel.app/](https://ai-content-curator-backend.vercel.app/).**

---

## Overview

The **Government Content Curator Backend** is a robust API service designed to serve curated articles to government staff. This backend performs the following tasks:

- **Data Ingestion:**  
  Aggregates article URLs from government homepage sources and public APIs such as NewsAPI (fetched by an external crawler service).

- **Content Processing:**  
  Uses AI-powered summarization via Google Generative AI (Gemini) to generate concise summaries from full article content.

- **Data Storage:**  
  Stores articles—including URLs, titles, full content, AI-generated summaries, source information, and fetch timestamps—in MongoDB via Mongoose.

- **API Serving:**  
  Exposes RESTful endpoints (built with Express.js running within a Next.js project) for a frontend application to retrieve article lists and details.

- **Scheduled Updates:**  
  A serverless function, deployed on Vercel and scheduled via cron, periodically fetches and processes new articles (running twice daily at 6:00 AM and 6:00 PM UTC).

> **Note:** The actual crawling logic has been decoupled and placed in a separate [crawler directory](../crawler/README.md). This backend focuses on storing, summarizing, and serving content.

---

## Architecture Overview

```
      +----------------+       +--------------------------+
      |                |       |                          |
      |   Data Sources |       |   Public API Sources     |
      |                |       |   (e.g., NewsAPI)        |
      +--------+-------+       +-------------+------------+
               |                              |
               |                              |
               v                              v
      +----------------+       +--------------------------+
      |                |       |                          |
      | Custom Crawlers|       | API Fetcher Service      |
      | (Homepage      |       |                          |
      |  Crawling)     |       +-------------+------------+
      +--------+-------+                     |
               |                             |
               +------------+----------------+
                            |
                            v
                  +--------------------+
                  |                    |
                  |   Data Processing  |
                  | (Summarization via |
                  |  Gemini AI /       |
                  | GoogleGenerativeAI)|
                  |                    |
                  +---------+----------+
                            |
                            v
                  +--------------------+
                  |                    |
                  |   MongoDB Storage  |
                  | (via Mongoose)     |
                  |                    |
                  +---------+----------+
                            |
                            v
                  +--------------------+
                  |                    |
                  |   Express.js API   |
                  | (REST Endpoints)   |
                  |                    |
                  +---------+----------+
                            |
                            v
                  +--------------------+
                  |                    |
                  |   Next.js Frontend |
                  |  (Consumer of API) |
                  |                    |
                  +--------------------+
```

---

## Detailed Description

### Data Ingestion & Processing

- **Decoupled Crawler & API Fetcher:**  
  The system gathers article URLs from multiple sources (e.g., government homepages, public APIs). The crawling is performed by a separate crawler service (see [crawler directory](../crawler/README.md)). This backend receives article data, then applies AI-based summarization using Google Generative AI (Gemini).

- **Content Summarization:**  
  Summarization is performed using Google Generative AI. This service uses predefined safety settings and implements a retry mechanism for handling rate limits (HTTP 429) and other transient issues.

### Database & Storage

- **MongoDB & Mongoose:**  
  Article data is stored in MongoDB with schemas defined via Mongoose. Each article document contains:
  - **URL**
  - **Title**
  - **Full Content**
  - **AI-Generated Summary**
  - **Source Information**
  - **Fetched Timestamp**

### API Layer

- **Express.js API Endpoints:**  
  The backend provides the following RESTful endpoints (running within a Next.js environment):

  | **Method** | **Endpoint**        | **Description**                                                                       |
  | ---------- | ------------------- | ------------------------------------------------------------------------------------- |
  | GET        | `/api/articles`     | Returns a paginated list of articles. Accepts `page`, `limit`, `source` query params. |
  | GET        | `/api/articles/:id` | Retrieves detailed information about a single article by its ID.                      |

---

## Scheduling & Deployment

- **Scheduled Fetch Function**  
  A function at `/api/scheduled/fetchAndSummarize` is deployed on Vercel, triggered twice daily (6:00 AM & 6:00 PM UTC) via Vercel cron. Although actual crawling is decoupled, this function orchestrates final data ingestion, AI summarization, and storage updates.

- **Express + Next.js**  
  The project runs Express.js routes within Next.js, all deployed on Vercel. This setup allows for seamless scaling and easy environment management.

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **MongoDB** (local or cloud)
- **Vercel CLI** (for deployment)

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/hoangsonww/AI-Gov-Content-Curator.git
   cd AI-Gov-Content-Curator/backend
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**

   Create a `.env` file in the root with:

   ```dotenv
   MONGODB_URI=your_production_mongodb_connection_string
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   AI_INSTRUCTIONS=Your system instructions for Gemini AI
   NEWS_API_KEY=your_newsapi_key
   PORT=3000
   CRAWL_URLS=https://www.whitehouse.gov/briefing-room/,https://www.congress.gov/,https://www.state.gov/press-releases/,https://www.bbc.com/news,https://www.nytimes.com/
   ```

### Run Locally

```bash
npm run dev
```

The server runs on `http://localhost:3000`. Test endpoints like:

- `GET /api/articles`
- `GET /api/articles/:id`

---

## Deployment on Vercel

Create or update **`vercel.json`**:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ]
}
```

- **Builds**: Uses `@vercel/next` to build the Next.js + Express project.
- **Crons**: Schedules the function at `/api/scheduled/fetchAndSummarize` for 6:00 AM and 6:00 PM UTC daily.

### Steps to Deploy

1. **Set Environment Variables** in Vercel project settings (MONGODB_URI, GOOGLE_AI_API_KEY, etc.).
2. **Deploy**:

   ```bash
   vercel --prod
   ```

---

## Logging & Error Handling

- **Logging:**  
  Basic console logging is used during development. In production, consider advanced logging solutions (e.g., Winston, Sentry) for more robust monitoring.

- **Error Handling:**
  - AI summarization implements retry logic for rate-limiting or transient errors.
  - Duplicate articles are gracefully skipped via unique constraints in MongoDB.

---

## Conclusion

The **Government Content Curator Backend** offers a scalable, AI-driven way to serve summarized articles to government staff. By integrating Google Generative AI, Next.js + Express, and MongoDB, this service provides reliable endpoints for retrieving and displaying fresh content. The **crawler** is decoupled for flexibility, while the scheduled fetch function ensures timely updates.

Happy Building!

---
