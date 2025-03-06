import { GetServerSideProps } from 'next'
import ArticleList from '../components/ArticleList'

export interface Article {
  _id: string
  url: string
  title: string
  content: string
  summary: string
  source: string
  fetchedAt: string
}

interface HomePageProps {
  articles: Article[]
}

export default function HomePage({ articles }: HomePageProps) {
  return (
      <div>
        <h1 className="page-title">Latest Articles</h1>
        <ArticleList articles={articles} />
      </div>
  )
}

// Using Server-Side Rendering (SSR) to fetch articles
export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Example: Replace with your actual backend URL
    const res = await fetch('http://localhost:3000/api/articles?page=1&limit=10')
    if (!res.ok) throw new Error('Failed to fetch articles')
    const { data } = await res.json()

    return {
      props: {
        articles: data || []
      }
    }
  } catch (error) {
    console.error('Error fetching articles:', error)
    return {
      props: {
        articles: []
      }
    }
  }
}
