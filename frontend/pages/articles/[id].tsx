import { GetServerSideProps } from "next";
import Link from "next/link";
import { MdHome } from "react-icons/md";
import { Article } from "../index";
import ArticleDetail from "../../components/ArticleDetail";
import { getArticleById } from "../../services/api";

interface ArticlePageProps {
  article: Article | null;
}

export default function ArticlePage({ article }: ArticlePageProps) {
  if (!article) {
    return <div className="error-message">Article not found</div>;
  }

  return (
    <div>
      <ArticleDetail article={article} />
      <div className="back-home-container">
        <Link href="/" legacyBehavior>
          <a className="back-home-link">
            <MdHome className="home-icon" size={20} />
            Back to Home
          </a>
        </Link>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};

  try {
    const article = await getArticleById(id as string);

    // Overwrite the 'content' field with the 'summary' field so that ArticleDetail displays the summary.
    if (article && article.summary) {
      article.content = article.summary;
    }

    return {
      props: {
        article,
      },
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    return {
      props: {
        article: null,
      },
    };
  }
};
