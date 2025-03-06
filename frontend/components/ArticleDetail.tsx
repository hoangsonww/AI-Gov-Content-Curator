import { Article } from '../pages'

interface ArticleDetailProps {
    article: Article
}

export default function ArticleDetail({ article }: ArticleDetailProps) {
    return (
        <div className="article-detail hover-animate">
            <h1 className="detail-title">{article.title}</h1>
            <p className="detail-meta">Source: {article.source}</p>
            <p className="detail-meta">
                Fetched at: {new Date(article.fetchedAt).toLocaleString()}
            </p>
            <div className="detail-content">{article.content}</div>
        </div>
    )
}
