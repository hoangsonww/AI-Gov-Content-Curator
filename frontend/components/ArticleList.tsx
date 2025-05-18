import { Article } from "../pages/home";
import ArticleCard from "./ArticleCard";

interface ArticleListProps {
  articles: Article[];
  loading?: boolean;
}

export default function ArticleList({
  articles,
  loading = false,
}: ArticleListProps) {
  if (!loading && (!articles || articles.length === 0)) {
    return <div className="error-message">No articles found.</div>;
  }

  return (
    <div className="article-grid">
      {articles.map((article) => (
        <ArticleCard key={article._id} article={article} />
      ))}
    </div>
  );
}
