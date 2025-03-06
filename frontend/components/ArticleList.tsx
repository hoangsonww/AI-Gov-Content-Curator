import { Article } from '../pages'
import ArticleCard from './ArticleCard'

interface ArticleListProps {
    articles: Article[]
}

export default function ArticleList({ articles }: ArticleListProps) {
    if (!articles || articles.length === 0) {
        return <div className="error-message">No articles found.</div>
    }

    return (
        <div>
            {articles.map((article) => (
                <div key={article._id} className="hover-animate">
                    <ArticleCard article={article} />
                </div>
            ))}
        </div>
    )
}
