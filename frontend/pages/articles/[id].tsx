import { GetStaticPaths, GetStaticProps } from "next";
import Link from "next/link";
import Head from "next/head";
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

  // Use the first 5 words of the article's title for the dynamic page title.
  const titleWords = article.title.split(" ").slice(0, 5).join(" ");
  const dynamicTitle = `Article Curator - ${titleWords}`;

  return (
    <>
      <Head>
        <title>{dynamicTitle}</title>
      </Head>
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
    </>
  );
}

// Use getStaticPaths with fallback blocking so that pages are generated on-demand.
export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { id } = context.params || {};

  try {
    const article = await getArticleById(id as string);

    // Overwrite the 'content' field with the 'summary' so ArticleDetail displays the summary.
    if (article && article.summary) {
      article.content = article.summary;
    }

    return {
      props: {
        article,
      },
      revalidate: 43200, // Revalidate every 12 hours
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    return {
      props: {
        article: null,
      },
      revalidate: 43200,
    };
  }
};
