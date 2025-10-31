# Related Articles Carousel - Implementation Guide

## Overview

This feature adds a related articles carousel to article detail pages using Pinecone vector similarity search with Google's text-embedding-004 model.

## Components

### 1. Backend Service (`backend/src/services/pinecone.service.ts`)

- **upsertArticleVector**: Vectorizes and stores articles in Pinecone
- **findSimilarArticles**: Retrieves similar articles using ANN (Approximate Nearest Neighbor)
- **deleteArticleVector**: Removes article vectors from Pinecone

### 2. Backend API Endpoint

- **GET** `/api/articles/:id/similar?limit=6`
- Returns similar articles based on vector similarity
- Supports optional limit parameter (default: 6)

### 3. Crawler Integration (`crawler/services/pinecone.service.ts`)

- Non-blocking vectorization when articles are added to MongoDB
- Uses `setImmediate()` to avoid blocking the main crawler logic
- Automatic sync between MongoDB and Pinecone

### 4. Frontend Component (`frontend/components/RelatedArticles.tsx`)

- Responsive carousel using react-slick
- Shows 3 articles on desktop, 2 on tablet, 1 on mobile
- Auto-play with 5-second intervals
- Hover to pause
- Dark mode support

## Setup Instructions

### 1. Environment Variables

Add to `backend/.env` and `crawler/.env`:

```env
PINECONE_API_KEY=
PINECONE_INDEX=
```

### 2. One-Time Vectorization of Existing Articles

Run this script to vectorize all existing articles in MongoDB:

```bash
cd backend
npx ts-node src/scripts/vectorizeArticles.ts
```

This will:

- Connect to MongoDB
- Fetch all articles in batches of 50
- Generate embeddings using Google's text-embedding-004
- Upload vectors to Pinecone with metadata
- Show progress and completion stats

**Note**: This can take time depending on the number of articles. The script includes a 100ms delay between articles to avoid rate limiting.

### 3. Automatic Sync (Already Integrated)

The crawler script (`crawler/scripts/fetchLatestArticles.ts`) now automatically:

- Saves new articles to MongoDB
- Asynchronously vectorizes and uploads to Pinecone
- Logs any vectorization errors without blocking the crawler

## Architecture

### Vector Embedding

- **Model**: Google Generative AI `text-embedding-004`
- **Input**: Article title + summary
- **Dimension**: 768 (default for text-embedding-004)

### Pinecone Storage

Each vector stores:

- **id**: MongoDB article ID
- **values**: 768-dimensional embedding vector
- **metadata**:
  - url
  - title
  - summary
  - topics (array)
  - source
  - fetchedAt

### Similarity Search

- Uses cosine similarity (Pinecone default)
- Filters out the query article itself
- Returns top K similar articles with scores
- Combines with recency/quality heuristics (via metadata)

## Usage

### Frontend

The carousel automatically appears on article detail pages (`/articles/[id]`).

### API Testing

```bash
curl https://your-backend.com/api/articles/ARTICLE_ID/similar?limit=6
```

Response:

```json
{
  "data": [
    {
      "id": "article_id",
      "title": "Article Title",
      "summary": "Article summary...",
      "topics": ["topic1", "topic2"],
      "source": "source.com",
      "fetchedAt": "2025-01-15T10:30:00Z",
      "score": 0.92
    }
  ]
}
```

## Performance Considerations

1. **Non-blocking**: Vectorization happens asynchronously via `setImmediate()`
2. **Batching**: Initial vectorization processes 50 articles at a time
3. **Rate Limiting**: 100ms delay between embeddings to avoid API limits
4. **Caching**: Frontend could add SWR caching for similar articles
5. **Error Handling**: Vectorization errors are logged but don't break the crawler
