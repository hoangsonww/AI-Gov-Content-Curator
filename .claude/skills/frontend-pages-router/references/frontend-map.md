# Frontend Map

## Key Routes

- `frontend/pages/index.tsx`: marketing landing page
- `frontend/pages/home.tsx`: main article browsing surface
- `frontend/pages/articles/[id].tsx`: article detail page
- `frontend/pages/ai_chat.tsx`: sitewide AI chat
- `frontend/pages/auth/`: auth screens
- `frontend/pages/favorites/`
- `frontend/pages/newsletter.tsx`

## Key Components

- `frontend/components/ArticleSearch.tsx`
- `frontend/components/ArticleDetail.tsx`
- `frontend/components/Comments.tsx`
- `frontend/components/RatingSection.tsx`
- `frontend/components/RelatedArticles.tsx`
- `frontend/components/RecommendedArticles.tsx`
- `frontend/components/AuthDropdown.tsx`
- `frontend/components/TranslateProvider.tsx`

## Services

- `frontend/services/api.ts`
- `frontend/services/comments.ts`
- `frontend/services/ratings.ts`
- `frontend/services/reranker.ts`

## Commands

- `npm run dev`
- `npm run lint`
- `npm run test:e2e`

## Known Fragility

- mixed hard-coded API URL and env-driven API URL
- token header inconsistency
- localStorage coupling
- heavy article detail page composition
