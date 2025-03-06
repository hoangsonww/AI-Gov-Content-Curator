import { GetServerSideProps } from 'next'
import { Article } from '../index'
import ArticleDetail from '../../components/ArticleDetail'

interface ArticlePageProps {
    article: Article | null
}

export default function ArticlePage({ article }: ArticlePageProps) {
    if (!article) {
        return <div className="error-message">Article not found</div>
    }

    return (
        <div>
            <ArticleDetail article={article} />
        </div>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { id } = context.params || {}

    try {
        // Replace with your actual backend URL
        const res = await fetch(`http://localhost:3000/api/articles/${id}`)
        if (!res.ok) throw new Error(`Failed to fetch article with id ${id}`)
        const { data } = await res.json()

        return {
            props: {
                article: data
            }
        }
    } catch (error) {
        console.error('Error fetching article:', error)
        return {
            props: {
                article: null
            }
        }
    }
}
