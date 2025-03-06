# AI-Powered Article Summarization & Curation System

[![Node.js](https://img.shields.io/badge/Node.js-v18.x-green?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-brightgreen?logo=mongodb)](https://mongodb.com/)
[![Cheerio](https://img.shields.io/badge/Cheerio-1.x-yellow?logo=npm)](https://cheerio.js.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-19.x-blue?logo=googlechrome)](https://pptr.dev/)
[![GoogleGenerativeAI](https://img.shields.io/badge/Google%20Gemini%20AI-GenerativeAI-red?logo=google)](https://developers.generativeai.google/)
[![Next.js](https://img.shields.io/badge/Next.js-13.x-black?logo=next.js)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel)](https://vercel.com/)

This **backend** automatically crawls, summarizes, and stores articles from various sources (e.g., government homepages or NewsAPI). It exposes **REST endpoints** consumed by a **Next.js** frontend. **Daily** or **scheduled** tasks ensure fresh content, and an optional **AI** (Gemini) summarizes articles for easier reading.

---

## Architecture Diagram (Text-Based)

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

## Backend Components

### Crawlers

- **Axios + Cheerio** for static pages.
- **Puppeteer** if a site blocks or requires JS rendering.
- Configurable homepage URLs (`HOMEPAGE_URLS` / `CRAWL_URLS`).

### Public API Fetcher

- Optional fetching of articles from **NewsAPI** or any public source.
- Merges with crawler output for broader coverage.

### Summarization (Processing)

- **Google Gemini AI** via `@google/generative-ai`.
- Retries on HTTP 429 rate-limit errors.
- Uses environment variable `AI_INSTRUCTIONS` for system prompt.

### MongoDB + Mongoose

- Stores articles with fields: `url`, `title`, `content`, `summary`, `source`, `fetchedAt`.
- Provides easy queries and filters by `source` or date.

### Express.js API

- `GET /api/articles` with pagination & filter (`source`).
- `GET /api/articles/:id` for detailed info.
- `GET /api/scheduled/fetchAndSummarize` for manual trigger (if deployed).

### Vercel Cron & Deployment

- `vercel.json` can schedule `fetchAndSummarize.ts` at desired times (e.g., `0 6,18 * * *`).
- Express server runs as a Vercel serverless function or custom Node deployment.

---

## File Structure Overview

```
AI-Gov-Content-Curator/
├─ backend/
│  ├─ controllers/
│  │  └─ article.controller.ts
│  ├─ models/
│  │  └─ article.model.ts
│  ├─ routes/
│  │  └─ article.routes.ts
│  ├─ services/
│  │  ├─ crawler.service.ts
│  │  ├─ apiFetcher.service.ts
│  │  └─ summarization.service.ts
│  ├─ schedule/
│  │  └─ fetchAndSummarize.ts
│  ├─ app.ts
│  ├─ index.ts
│  ├─ vercel.json
│  ├─ swagger/
│  │  └─ swagger.ts
│  └─ package.json
└─ frontend/
   ├─ components/
   │  ├─ ArticleCard.tsx
   │  ├─ ArticleDetail.tsx
   │  ├─ ArticleList.tsx
   │  ├─ AllArticles.tsx
   │  ├─ LatestArticles.tsx
   │  ├─ HeroSlider.tsx
   │  ├─ Navbar.tsx
   │  ├─ Footer.tsx
   │  └─ ...
   ├─ pages/
   │  ├─ articles/
   │  │  └─ [id].tsx
   │  ├─ _app.tsx
   │  ├─ _document.tsx
   │  └─ index.tsx
   ├─ styles/
   │  ├─ globals.css
   │  └─ theme.css
   ├─ package.json
   └─ tsconfig.json
```

---

## Technologies (Extended List)

- **Node.js** + **Express**
- **MongoDB** + **Mongoose**
- **Cheerio** + **Axios**
- **Puppeteer**
- **Google Generative AI (Gemini)**
- **Next.js** for the frontend
- **Vercel** for deployment + cron scheduling
- **Typescript**
- **dotenv** for environment variables

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB instance (local or cloud)
- Vercel CLI for serverless deployment (optional)

### Installation (Backend)

1. **Clone** the repo, then:
   ```bash
   cd AI-Gov-Content-Curator/backend
   npm install
   ```
2. **Environment**: Create `.env` in `backend/`:
   ```dotenv
   MONGODB_URI=your_mongo_uri
   GOOGLE_AI_API_KEY=your_google_api_key
   AI_INSTRUCTIONS="Your summarization prompt"
   NEWS_API_KEY=your_newsapi_key
   HOMEPAGE_URLS="https://www.whitehouse.gov/,https://www.congress.gov/"
   PORT=3000
   ```
3. **Run** locally:
   ```bash
   npm run dev
   ```
   API on [http://localhost:3000](http://localhost:3000).

4. **Test** summarization job:
   ```bash
   npx ts-node src/schedule/fetchAndSummarize.ts
   ```

### Deployment

#### Vercel

1. **`vercel.json`**:
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
2. **Deploy**:
   ```bash
   vercel --prod
   ```
   Your Express + scheduled function is now live.

#### Custom

Run `npm run build` and `npm start` on your own Node server.

---

## API Endpoints

| **Endpoint**                          | **Method** | **Query Params**                                    | **Description**                                                                                          |
|--------------------------------------:|-----------:|-----------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `/api/articles`                       | **GET**    | **page** (number, default=1) <br> **limit** (default=10) <br> **source** (string, optional) | Returns JSON: `{ data: [Article], total: count }`. Sorted by fetched date (descending).                  |
| `/api/articles/:id`                   | **GET**    | *(none)*                                            | Retrieves a single article by `_id`, returning full JSON.                                                |
| `/api/scheduled/fetchAndSummarize`    | **GET**    | *(none)*                                            | Manually triggers crawling + summarization. Typically invoked by Vercel cron or for testing.              |

---

## Logging & Error Handling

- **Logging**: Basic console logs by default.
- **Crawler**:
  - Retries **ECONNRESET**, or uses **Puppeteer** if static fetch fails.
  - Skips duplicates if Mongoose code `11000`.
- **Summarization**:
  - Retries if AI returns 429.
- **Global**:
  - Returns 500 for unhandled issues, 404 for unknown routes.

---

## Future Enhancements

- **Containerization** (Docker + Compose or Kubernetes).
- **Advanced BFS** crawling for multi-level subpages.
- **Redis** caching to speed up certain repeated article fetches.
- **Search** or indexing for quick article lookups.
- **Auth** or roles if editorial control is needed.

---

## Frontend Overview

The **frontend** is a Next.js 13 app (in `frontend/`), featuring:

- **Dark/Light/System** theme.
- An **Article List** with SSR for the latest articles.
- A **Load More** approach (client-side) for “All Articles.”
- **Optional** top slider for “featured” articles.
- **Responsive** design with minimal styling.

**Local** usage:

```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and ensure your **backend** is up.

---

## Conclusion

This **Government Content Curator** system leverages modern tooling and AI to deliver fresh, concise articles for government staff:

- **Multiple** ingestion paths (crawlers + public APIs).
- **Gemini AI** summarization.
- **MongoDB** for storage.
- **Express** endpoints and daily or on-demand crawling.
- **Next.js** UI for a polished, theme-friendly reading experience.

It’s **scalable, flexible,** and easy to deploy on **Vercel** or your preferred Node environment. Enjoy exploring the code and customizing it for your government content needs.
