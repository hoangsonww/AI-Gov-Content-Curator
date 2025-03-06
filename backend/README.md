# Government Content Curator Backend

This backend service is designed to automatically crawl, summarize, and store articles from various sources for government staff. It uses a combination of custom crawling, public API fetching, AI-powered content summarization, and MongoDB for data storage. The backend also exposes RESTful APIs for the frontend (built with Next.js) to retrieve article summaries and details.

## Architecture Overview

Below is a text-based diagram illustrating the system architecture:

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

## Detailed Description

### Data Ingestion Layer

- **Custom Crawlers:**  
  The crawler service is implemented using Axios and Cheerio for static HTML pages. In case of HTTP 403 errors or other issues (like ECONNRESET), the service falls back to Puppeteer (dynamic fetch) to simulate a real browser. Additionally, a helper function (`crawlArticlesFromHomepage`) extracts article links from given homepage URLs.

- **Public API Fetcher:**  
  The API fetcher service retrieves articles from public APIs like NewsAPI, ensuring additional content sources.

### Processing Layer

- **Content Summarization:**  
  The summarization service leverages Google’s Generative AI (Gemini) via the `@google/generative-ai` package. It is configured with safety settings and includes a retry mechanism for handling rate limits (HTTP 429 responses).

### Database and Storage

- **MongoDB (via Mongoose):**  
  All articles (including their URLs, titles, full content, summaries, sources, and fetch timestamps) are stored in a MongoDB database. Mongoose is used for schema definition and data modeling.

### API Layer

- **Express.js Endpoints:**  
  The backend exposes RESTful API endpoints for the frontend:
  - `GET /api/articles` – Lists articles with support for pagination and filtering.
  - `GET /api/articles/:id` – Retrieves detailed information about a specific article.

### Scheduling and Deployment

- **Vercel Scheduled Functions:**  
  The fetch-and-summarize script is deployed as a Vercel serverless function under `/api/scheduled/fetchAndSummarize.ts`. Vercel’s cron functionality (configured via `vercel.json`) automatically triggers the function at 6:00 AM and 6:00 PM every day.

- **Express Server:**  
  The Express app handles API requests and is deployed alongside the scheduled functions on Vercel.

## Getting Started

### Prerequisites

- **Node.js** (v18 or later recommended)
- **MongoDB** (a running instance, local or cloud)
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

3. **Setup Environment Variables:**

   Create a `.env` file in the root directory with the following contents (replace placeholders with your actual credentials):

   ```dotenv
   MONGODB_URI=your_production_mongodb_connection_string
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   AI_INSTRUCTIONS=Your system instructions for Gemini AI
   NEWS_API_KEY=your_newsapi_key
   HOMEPAGE_URLS=https://www.whitehouse.gov/briefing-room/,https://www.congress.gov/,https://www.state.gov/
   PORT=3000
   ```

4. **Build the Project (if needed):**
   ```bash
   npm run build
   ```

### Running Locally

- **Start the Express Server (for API endpoints):**
  ```bash
  npm run dev
  ```
- **Test the Scheduled Function Manually:**
  ```bash
  npx ts-node src/schedule/fetchAndSummarize.ts
  ```

## Deployment on Vercel

1. **Create a `vercel.json` file in the project root with the following content:**

   ```json
   {
     "functions": {
       "api/scheduled/fetchAndSummarize.ts": {
         "runtime": "nodejs18.x",
         "schedule": "0 6,18 * * *"
       }
     }
   }
   ```

   This configuration schedules the fetch-and-summarize function to run at 6:00 AM and 6:00 PM (server time) daily.

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```
   Vercel will deploy your Express API along with the scheduled function.

## API Endpoints

- **GET /api/articles**

  - **Description:** Retrieves a paginated list of articles.
  - **Query Parameters:**
    - `page`: Page number (default: 1)
    - `limit`: Number of articles per page (default: 10)
    - `source`: (Optional) Filter articles by source.
  - **Example:**
    ```bash
    curl -X GET "https://your-deployment.vercel.app/api/articles?page=1&limit=10" -H "Accept: application/json"
    ```

- **GET /api/articles/:id**

  - **Description:** Retrieves detailed information about a specific article.
  - **Example:**
    ```bash
    curl -X GET "https://your-deployment.vercel.app/api/articles/<ARTICLE_ID>" -H "Accept: application/json"
    ```

- **GET /api/scheduled/fetchAndSummarize**
  - **Description:** Manually triggers the scheduled fetch and summarization process.  
    (This endpoint is mainly for testing; it is automatically triggered by Vercel Cron.)
  - **Example:**
    ```bash
    curl -X GET "https://your-deployment.vercel.app/api/scheduled/fetchAndSummarize" -H "Accept: application/json"
    ```

## Logging and Error Handling

- **Logging:**  
  The backend uses console logging for monitoring. In production, consider integrating a logging service (e.g., Winston, Pino, or Sentry) for more robust error tracking.

- **Error Handling:**
  - The crawler service implements retry logic for connection resets and falls back to dynamic fetching when static fetching fails (e.g., due to a 403 error).
  - The summarization service retries on rate limiting (HTTP 429) and logs errors if summarization fails.
  - Duplicate articles are skipped when a MongoDB duplicate key error (code 11000) occurs.

## Future Enhancements

- **Containerization:**  
  While not required now, you may later containerize the application for enhanced scalability and deployment flexibility.
- **Advanced Scheduling:**  
  Consider integrating a dedicated task scheduler (e.g., BullMQ or AWS Step Functions) if your requirements grow.
- **Monitoring and Analytics:**  
  Integrate services like Sentry or New Relic for proactive monitoring and detailed performance insights.

## Conclusion

This backend service is built with scalability, reliability, and ease-of-deployment in mind. It integrates modern tools and APIs (such as Gemini AI for summarization and Vercel for scheduled functions) to deliver curated and summarized content efficiently for government staff. With robust error handling, request optimization, and scheduled tasks, it ensures that the latest articles are always available via its API endpoints for seamless consumption by a Next.js frontend.
