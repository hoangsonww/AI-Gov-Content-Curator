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
  article: Article;
}

/* ───────── PAGE ───────── */
export default function ArticlePage({ article }: ArticlePageProps) {
  let title = `${article.title.split(" ").slice(0, 5).join(" ")}`;

  if (!title || title.length === 0) {
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
    // if API returns null or empty, trigger 404
    if (!article) {
      return { notFound: true, revalidate: 43200 };
    }
    // use summary as content if present
    if (article.summary) {
      article.content = article.summary;
    }
    return {
      props: { article },
      revalidate: 43200, // 12 hours
    };
  } catch {
    // error fetching → also 404
    return { notFound: true, revalidate: 43200 };
  }
};
