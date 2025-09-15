# Rating System API Test Examples

## API Endpoints

The rating system provides the following endpoints:

### 1. Create or Update Rating

```bash
POST /api/ratings
```

**Request Body:**

```json
{
  "articleId": "68275522a116499139f16a6a",
  "value": 75,
  "ratingType": "meter",
  "comment": "Great article!",
  "sessionId": "unique-session-id-123"
}
```

**Example with meter rating (-100 to 100):**

```bash
curl -X POST http://localhost:3000/api/ratings \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "68275522a116499139f16a6a",
    "value": 75,
    "ratingType": "meter",
    "comment": "Very informative article",
    "sessionId": "session-123"
  }'
```

**Example with star rating (1 to 5):**

```bash
curl -X POST http://localhost:3000/api/ratings \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "68275522a116499139f16a6a",
    "value": 4,
    "ratingType": "stars",
    "comment": "Good read",
    "sessionId": "session-456"
  }'
```

### 2. Get User's Rating for an Article

```bash
GET /api/ratings/article/{articleId}/user?sessionId={sessionId}
```

**Example:**

```bash
curl -X GET "http://localhost:3000/api/ratings/article/68275522a116499139f16a6a/user?sessionId=session-123"
```

### 3. Get All Ratings for an Article

```bash
GET /api/ratings/article/{articleId}?page=1&limit=10
```

**Example:**

```bash
curl -X GET "http://localhost:3000/api/ratings/article/68275522a116499139f16a6a?page=1&limit=10"
```

### 4. Get Rating Statistics for an Article

```bash
GET /api/ratings/article/{articleId}/stats
```

**Example:**

```bash
curl -X GET "http://localhost:3000/api/ratings/article/68275522a116499139f16a6a/stats"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "articleId": "68275522a116499139f16a6a",
    "averageRating": 65.5,
    "totalRatings": 25,
    "meterRatings": 20,
    "starRatings": 5,
    "meterDistribution": {
      "60 to 80": 15,
      "80 to 100": 5
    },
    "starDistribution": {
      "3": 2,
      "4": 2,
      "5": 1
    }
  }
}
```

### 5. Get Bulk Ratings for Multiple Articles

```bash
POST /api/ratings/bulk
```

**Request Body:**

```json
{
  "articleIds": [
    "68275522a116499139f16a6a",
    "68275527a116499139f16a6c",
    "68275036cac71a2bc37534c4"
  ]
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/ratings/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "articleIds": [
      "68275522a116499139f16a6a",
      "68275527a116499139f16a6c"
    ]
  }'
```

### 6. Delete a Rating

```bash
DELETE /api/ratings/{ratingId}
```

**Request Body (for anonymous users):**

```json
{
  "sessionId": "session-123"
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/ratings/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-123"
  }'
```

## Testing the System

### Run the test script:

```bash
cd backend
npx ts-node src/scripts/test-rating-system.ts
```

### Start the server and test via API:

```bash
npm run dev
```

## Frontend Integration

### Example React component usage:

```javascript
// Create/Update Rating
const submitRating = async (articleId, value, ratingType = "meter") => {
  const sessionId = localStorage.getItem("sessionId") || generateSessionId();

  const response = await fetch("/api/ratings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      articleId,
      value,
      ratingType,
      sessionId,
      comment: commentText,
    }),
  });

  const data = await response.json();
  return data;
};

// Get article statistics
const getArticleStats = async (articleId) => {
  const response = await fetch(`/api/ratings/article/${articleId}/stats`);
  const data = await response.json();
  return data.data;
};

// Get user's rating
const getUserRating = async (articleId) => {
  const sessionId = localStorage.getItem("sessionId");
  const response = await fetch(
    `/api/ratings/article/${articleId}/user?sessionId=${sessionId}`,
  );
  const data = await response.json();
  return data.data;
};
```

## Rating Types

### Meter Rating System

- Range: -100 to 100
- Use case: Sentiment analysis, approval ratings, political lean
- Visual: Can be displayed as a horizontal meter/slider

### Star Rating System

- Range: 1 to 5
- Use case: Quality ratings, traditional reviews
- Visual: Standard 5-star display

## Notes

1. **Session Management**: For anonymous users, generate and store a unique sessionId in localStorage
2. **User Ratings**: If users are authenticated, the system will use userId instead of sessionId
3. **Uniqueness**: Each user/session can only have one rating per article
4. **Updates**: Submitting a new rating for the same article will update the existing rating
5. **Statistics**: The stats endpoint provides aggregated data including distribution charts
