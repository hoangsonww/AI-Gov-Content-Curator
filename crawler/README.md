# Crawler Service for SynthoraAI - AI Article Content Curator (work in progress)

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org)
[![Axios](https://img.shields.io/badge/Axios-%23007ACC.svg?style=flat&logo=axios&logoColor=white)](https://github.com/axios/axios)
[![Cheerio](https://img.shields.io/badge/Cheerio-%23E34F26.svg?style=flat&logo=cheerio&logoColor=white)](https://cheerio.js.org)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-%23FF5722.svg?style=flat&logo=puppeteer&logoColor=white)](https://pptr.dev)
[![Vercel](https://img.shields.io/badge/Vercel-000?style=flat&logo=vercel&logoColor=white)](https://vercel.com)
[![Cron](https://img.shields.io/badge/Cron-%232C3E50.svg?style=flat&logo=cron&logoColor=white)](https://en.wikipedia.org/wiki/Cron)

This README details the **Crawler Service** which is a core component of the Government Content Curator system. The crawler is responsible for automatically crawling various data sources, extracting article links, and preparing content for further processing and summarization by our AI-powered engine. **In addition to the crawler**, this project features a **very simple Next.js UI** served at the root path (`/`), providing a landing page with basic information about the crawler and links to the main backend and frontend.

The crawler portion has been decoupled from the main backend and is deployed on Vercel as a serverless function, scheduled to run every day at **6 AM UTC** via a cron job.

Live at: [https://ai-content-curator-crawler.vercel.app/](https://ai-content-curator-crawler.vercel.app/)

To access the crawler function directly, visit: [https://ai-content-curator-crawler.vercel.app/api/scheduled/fetchAndSummarize](https://ai-content-curator-crawler.vercel.app/api/scheduled/fetchAndSummarize). Note that it may take some time to run since crawling multiple sites can be **VERY** time-consuming.

---

## Architecture Overview

Below is a text-based diagram illustrating the crawler’s position in the overall system architecture:

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
      | Custom Crawler |       | API Fetcher Service      |
      | (URL           |       |                          |
      |  Crawlings)    |       +-------------+------------+
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

### Data Ingestion & Extraction

- **Custom Crawlers:**  
  The crawler is implemented using **Axios** and **Cheerio** for handling static HTML pages. When encountering issues like HTTP 403 errors or ECONNRESET, it seamlessly falls back to **Puppeteer** to perform dynamic fetching—mimicking real browser behavior to bypass such restrictions.

- **Article Extraction:**  
  A dedicated helper function (`crawlArticlesFromHomepage`) scans homepage URLs, extracts article links and metadata, and forwards them to the next stage of processing. This enables efficient aggregation of content from multiple government-related sources.

### Error Handling & Resilience

- **Retry Mechanism:**  
  The service implements a retry mechanism to handle intermittent failures. In cases of temporary network issues or rate limits, the crawler will attempt to re-fetch content without manual intervention.

- **Fallback Strategies:**  
  If static fetching via Axios/Cheerio fails, the system automatically switches to a dynamic fetching approach using Puppeteer. This ensures continuous operation even when encountering sites with stricter content-delivery policies.

### Deployment & Scheduling

- **Next.js UI at Root:**  
  This repository also includes a **basic Next.js page** served at the root (`/`). This page provides a simple landing screen with details about the crawler, plus helpful links to the main backend and frontend.

- **Vercel Deployment:**  
  The crawler function is deployed as a serverless function on Vercel. This approach ensures high scalability and minimal maintenance overhead.

- **Cron Job Scheduling:**  
  The crawler is set to run automatically via a cron job at **6 AM UTC** daily. This scheduling is managed through Vercel’s serverless cron functionality, ensuring that new articles are fetched, summarized, and stored regularly.

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or later recommended)
- **NPM** (or Yarn, for package management)
- **Vercel CLI** (for deployment)

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/hoangsonww/AI-Gov-Content-Curator.git
   cd AI-Gov-Content-Curator/crawler
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Setup Environment Variables:**

   Create a `.env` file in the crawler directory with the following entries (replace placeholders with actual values):

   ```dotenv
   MONGODB_URI=
   GOOGLE_AI_API_KEY=
   AI_INSTRUCTIONS=
   NEWS_API_KEY=
   PORT=3000
   CRAWL_URLS=https://www.whitehouse.gov/briefing-room/,https://www.congress.gov/,https://www.state.gov/press-releases/,https://www.bbc.com/news,https://www.nytimes.com/
   ```

4. **Run Locally:**

   You can test the **Next.js UI** and the crawler logic locally using:

   ```bash
   npm run dev
   ```

   This will start your Next.js development server.

- The UI is accessible at `http://localhost:3000/`.
- Your crawler function is accessible at `http://localhost:3000/api/scheduled/fetchAndSummarize`.

Alternatively, you can run the crawler function directly via:

```bash
npx ts-node schedule/fetchAndSummarize.ts
```

This will trigger the crawler function without starting the Next.js server.

---

## Deployment on Vercel

### Next.js + Cron Setup

Below is a minimal `vercel.json` example to deploy a Next.js project **and** schedule the crawler:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "crons": [
    {
      "path": "/api/scheduled/fetchAndSummarize",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- **`@vercel/next`**: Tells Vercel to treat this as a Next.js project, automatically building pages (including the UI at `/`) and API routes (e.g., `/api/scheduled/fetchAndSummarize`).
- **Cron Job**: Triggers the crawler function (`/api/scheduled/fetchAndSummarize`) at **6:00 AM UTC** daily.

### Steps to Deploy

1. **Add the `.env` Variables** to the Vercel Project:  
   In your Vercel dashboard, set environment variables like `MONGODB_URI`, `GOOGLE_AI_API_KEY`, etc.

2. **Deploy with Vercel CLI** (or via GitHub Integration):

   ```bash
   vercel --prod
   ```

   Once deployed, Vercel will serve your Next.js UI at the root path (`/`) and schedule the crawler function at `/api/scheduled/fetchAndSummarize`.

---

## Additional Information

- **Logging:**  
  The crawler service logs to the console for monitoring. Consider advanced solutions like Winston or Sentry in production for richer error handling.

- **Future Enhancements:**
  - **Extended UI**: Expand the basic Next.js page into a richer dashboard (graphs, logs, user auth, etc.).
  - **Enhanced Scheduling**: Provide more granular scheduling or on-demand triggers.
  - **Improved Error Reporting**: Integrate with alerting services (Slack, email, etc.) to notify administrators of crawler failures.

---

## Conclusion

This **Crawler Service** is a robust, scalable solution for automatically retrieving government-focused articles. Alongside a **simple Next.js UI** at the root for quick reference, it uses fallback strategies (Axios/Cheerio → Puppeteer), scheduled via Vercel Cron, and powered by Node.js and TypeScript. Whether you’re a developer or public official looking to harness AI-driven content aggregation, this system ensures **up-to-date** coverage of key sources daily.

Happy Crawling! ️🚀
