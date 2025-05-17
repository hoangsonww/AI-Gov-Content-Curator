import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import ReactDOM from "react-dom";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";

import { Article } from "../index";
import ArticleDetail from "../../components/ArticleDetail";
import { getArticleById } from "../../services/api";
import Chatbot from "../../components/Chatbot";
import { MdHome } from "react-icons/md";

/* ───────── TYPES ───────── */

interface ArticlePageProps {
  article: Article | null;
}

/* ───────── PAGE ───────── */
export default function ArticlePage({ article }: ArticlePageProps) {
  if (!article) return <div className="error-message">Article not found</div>;

  let title = `${article.title.split(" ").slice(0, 5).join(" ")}`;

  if (!title || title.length == 0) {
    title = "Title not available";
  }

  const dynamicTitle = `Article Curator – ${title}`;

  return (
    <>
      <Head>
        <title>{dynamicTitle}</title>
      </Head>

      <div className="page-wrapper">
        <ArticleDetail article={article} />

        <div className="nav-back">
          <Link href="/" legacyBehavior>
            <a>
              <MdHome size={20} />
              Back to Home
            </a>
          </Link>
        </div>

        <Chatbot article={article} />
      </div>

      <style jsx>{`
        .error-message {
          padding: 2rem;
          color: var(--accent-color);
          text-align: center;
        }
        .page-wrapper {
          position: relative;
          padding-bottom: 4rem;
        }
        .nav-back {
          margin: 2rem 0;
          text-align: center;
        }
        .nav-back a {
          color: var(--accent-color);
          text-decoration: none;
          font-weight: 600;
          display: inline-flex;
          gap: 0.4rem;
          align-items: center;
        }
      `}</style>
    </>
  );
}

/* ───────── STATIC HELPERS ───────── */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps<ArticlePageProps> = async (ctx) => {
  const { id } = ctx.params || {};
  try {
    const article = await getArticleById(id as string);
    if (article?.summary) article.content = article.summary;
    return { props: { article }, revalidate: 43200 };
  } catch {
    return { props: { article: null }, revalidate: 43200 };
  }
};
