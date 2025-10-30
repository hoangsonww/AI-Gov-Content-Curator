# Article Rating System Implementation

## Overview

A flexible rating system has been implemented to allow users to rate articles with either a meter-style rating (-100 to 100) or traditional star ratings (1-5). The system supports both authenticated users and anonymous sessions.

## Files Created

### 1. Model

- **`backend/src/models/rating.model.ts`**
  - Mongoose schema for ratings
  - Supports both meter (-100 to 100) and star (1-5) rating types
  - Includes validation, indexes, and unique constraints
  - Tracks user/session, article, value, type, and optional comments

### 2. Controller

- **`backend/src/controllers/rating.controller.ts`**
  - `createOrUpdateRating` - Create or update a rating
  - `getUserRating` - Get a user's/session's rating for an article
  - `getArticleRatings` - Get all ratings for an article (paginated)
  - `getArticleRatingStats` - Get aggregated statistics for an article
  - `deleteRating` - Delete a rating (owner only)
  - `getBulkArticleRatings` - Get ratings for multiple articles at once

### 3. Routes

- **`backend/src/routes/rating.routes.ts`**
  - `POST /api/ratings` - Create/update rating
  - `GET /api/ratings/article/:articleId/user` - Get user's rating
  - `GET /api/ratings/article/:articleId` - Get all ratings for article
  - `GET /api/ratings/article/:articleId/stats` - Get rating statistics
  - `POST /api/ratings/bulk` - Get ratings for multiple articles
  - `DELETE /api/ratings/:ratingId` - Delete a rating

### 4. Test Files

- **`backend/src/scripts/test-rating-system.ts`** - Unit test script for the rating model
- **`backend/test-rating-api.md`** - API endpoint documentation and test examples

### 5. Modified Files

- **`backend/src/app.ts`** - Added rating routes registration

## Key Features

### Rating Types

1. **Meter Rating**

   - Range: -100 to 100
   - Use case: Sentiment analysis, approval ratings, bias detection
   - Can represent: Very Negative (-100) to Very Positive (100)

2. **Star Rating**
   - Range: 1 to 5 stars
   - Use case: Traditional quality ratings
   - Familiar user interface pattern

### Data Structure

Each rating document contains:

- `articleId` - Reference to the article being rated
- `userId` - Reference to authenticated user (optional)
- `sessionId` - Session identifier for anonymous users (optional)
- `value` - Rating value (validated based on rating type)
- `ratingType` - Either "meter" or "stars"
- `comment` - Optional text comment (max 500 chars)
- `createdAt/updatedAt` - Timestamps

### Constraints

- One rating per user/session per article (enforced by unique indexes)
- Either userId or sessionId must be present
- Value validation based on rating type
- Automatic timestamp tracking

## Usage Examples

### Frontend Integration (React/Next.js)

```javascript
// Generate or retrieve session ID for anonymous users
const getSessionId = () => {
  let sessionId = localStorage.getItem("ratingSessionId");
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("ratingSessionId", sessionId);
  }
  return sessionId;
};

// Submit a rating
const submitRating = async (articleId, value, ratingType = "meter") => {
  const response = await fetch("/api/ratings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articleId,
      value,
      ratingType,
      sessionId: getSessionId(),
      comment: userComment, // optional
    }),
  });
  return response.json();
};

// Get rating statistics for display
const getArticleStats = async (articleId) => {
  const response = await fetch(`/api/ratings/article/${articleId}/stats`);
  const data = await response.json();
  return data.data; // Contains average, total, distribution
};
```

### UI Component Ideas

#### Meter Rating Component

```javascript
// Slider from -100 (far left) to 100 (far right)
<input
  type="range"
  min="-100"
  max="100"
  value={rating}
  onChange={(e) => setRating(e.target.value)}
/>
// Labels: "Very Negative" | "Negative" | "Neutral" | "Positive" | "Very Positive"
```

#### Star Rating Component

```javascript
// Traditional 5-star rating
[⭐][⭐][⭐][⭐][⭐]
```

## Database Indexes

The following indexes are automatically created for optimal performance:

- `articleId` - For querying ratings by article
- `userId` - For querying user's ratings (sparse index)
- `sessionId` - For querying session's ratings (sparse index)
- Compound unique indexes on `(articleId, userId)` and `(articleId, sessionId)`

## API Response Examples

### Rating Statistics Response

```json
{
  "success": true,
  "data": {
    "articleId": "68275522a116499139f16a6a",
    "averageRating": 42.5,
    "totalRatings": 150,
    "meterRatings": 120,
    "starRatings": 30,
    "meterDistribution": {
      "-100 to -80": 5,
      "-80 to -60": 10,
      "-60 to -40": 15,
      "-40 to -20": 20,
      "-20 to 0": 25,
      "0 to 20": 20,
      "20 to 40": 15,
      "40 to 60": 10,
      "60 to 80": 5,
      "80 to 100": 0
    },
    "starDistribution": {
      "1": 3,
      "2": 5,
      "3": 10,
      "4": 8,
      "5": 4
    }
  }
}
```

## Environment Setup

Ensure MongoDB connection is configured in your environment:

```bash
# .env file
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

## Testing

To test the rating system:

1. Ensure MongoDB is accessible
2. Run: `cd backend && npx ts-node src/scripts/test-rating-system.ts`
3. Or start the server and use the API endpoints documented in `backend/test-rating-api.md`
