# Frontend Map

## High-Risk Routes

- `frontend/pages/home.tsx`
- `frontend/pages/articles/[id].tsx`
- `frontend/pages/ai_chat.tsx`
- `frontend/pages/auth/`
- `frontend/pages/favorites/`

## High-Risk Components

- `frontend/components/ArticleSearch.tsx`
- `frontend/components/ArticleDetail.tsx`
- `frontend/components/Comments.tsx`
- `frontend/components/RatingSection.tsx`
- `frontend/components/RelatedArticles.tsx`
- `frontend/components/RecommendedArticles.tsx`
- `frontend/components/AuthDropdown.tsx`
- `frontend/components/TranslateProvider.tsx`

## Known Fragility

- mixed hard-coded and env-based API URLs
- token header inconsistency
- localStorage coupling
- heavy article-detail page composition
