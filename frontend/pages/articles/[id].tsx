import React, { useCallback, useState } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { MdHome, MdContentCopy, MdEmail, MdCheck } from "react-icons/md";
import { AiOutlineTwitter, AiFillLinkedin } from "react-icons/ai";
import { FaFacebookF } from "react-icons/fa";

import { Article } from "../home";
import ArticleDetail from "../../components/ArticleDetail";
import Chatbot from "../../components/Chatbot";
import { getArticleById } from "../../services/api";

interface ArticlePageProps {
  article: Article;
}

export default function ArticlePage({ article }: ArticlePageProps) {
  const [copied, setCopied] = useState(false);

  const copyAll = useCallback(() => {
    const parts = [
      `Title: ${article.title}`,
      article.source ? `Source: ${article.source}` : "",
      article.url ? `URL: ${article.url}` : "",
      article.summary ? `Summary:\n${article.summary}` : "",
      article.content ? `Content:\n${article.content}` : "",
      article.topics?.length ? `Topics: ${article.topics.join(", ")}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }, [article]);

  const shareEmail = useCallback(() => {
    const subject = encodeURIComponent(article.title);
    const body = encodeURIComponent(
      `${article.summary || article.content}\n\nRead more at ${
        typeof window !== "undefined" ? window.location.href : ""
      }`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [article]);

  const shareTwitter = useCallback(() => {
    const text = encodeURIComponent(
      `${article.title} – ${article.summary || ""}`,
    );
    const url = encodeURIComponent(
      typeof window !== "undefined" ? window.location.href : "",
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
    );
  }, [article]);

  const shareLinkedIn = useCallback(() => {
    const url = encodeURIComponent(
      typeof window !== "undefined" ? window.location.href : "",
    );
    const title = encodeURIComponent(article.title);
    const summary = encodeURIComponent(article.summary || "");
    window.open(
      `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}&summary=${summary}`,
      "_blank",
    );
  }, [article]);

  const shareFacebook = useCallback(() => {
    const url = encodeURIComponent(
      typeof window !== "undefined" ? window.location.href : "",
    );
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank",
    );
  }, []);

  let titlePreview =
    article.title.split(" ").slice(0, 5).join(" ") || "Title not available";
  const dynamicTitle = `Article Curator – ${titlePreview}`;

  return (
    <>
      <Head>
        <title>{dynamicTitle}</title>
      </Head>

      <div className="page-wrapper">
        <ArticleDetail article={article} />

        <div className="action-buttons">
          <button
            className={`action-btn ${copied ? "copied" : ""}`}
            onClick={copyAll}
            title="Copy all article info"
          >
            {copied ? <MdCheck size={20} /> : <MdContentCopy size={20} />}
          </button>
          <button
            className="action-btn"
            onClick={shareEmail}
            title="Share via Email"
          >
            <MdEmail size={20} />
          </button>
          <button
            className="action-btn"
            onClick={shareTwitter}
            title="Share on Twitter"
          >
            <AiOutlineTwitter size={20} />
          </button>
          <button
            className="action-btn"
            onClick={shareLinkedIn}
            title="Share on LinkedIn"
          >
            <AiFillLinkedin size={20} />
          </button>
          <button
            className="action-btn"
            onClick={shareFacebook}
            title="Share on Facebook"
          >
            <FaFacebookF size={20} />
          </button>
        </div>

        <div className="nav-back">
          <Link href="/home" legacyBehavior>
            <a>
              <MdHome size={20} />
              Back to Home
            </a>
          </Link>
        </div>

        <Chatbot article={article} />
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: "blocking",
});

export const getStaticProps: GetStaticProps<ArticlePageProps> = async (ctx) => {
  const { id } = ctx.params || {};

  try {
    const article = await getArticleById(id as string);
    if (!article) {
      return { notFound: true, revalidate: 43200 };
    }
    if (article.summary) {
      article.content = article.summary;
    }
    return {
      props: { article },
      revalidate: 43200, // 12 hours
    };
  } catch {
    return { notFound: true, revalidate: 43200 };
  }
};
