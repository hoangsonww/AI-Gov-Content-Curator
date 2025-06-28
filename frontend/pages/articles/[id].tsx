import React, { useCallback, useState } from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { MdHome, MdContentCopy, MdEmail, MdCheck } from "react-icons/md";
import { AiOutlineTwitter, AiFillLinkedin } from "react-icons/ai";
import { FaFacebookF } from "react-icons/fa";
import { motion, Variants } from "framer-motion";
import Comments from "../../components/Comments";
import { Article } from "../home";
import ArticleDetail from "../../components/ArticleDetail";
import Chatbot from "../../components/Chatbot";
import { getArticleById } from "../../services/api";

interface ArticlePageProps {
  article: Article;
}

const buttonContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const buttonItem: Variants = {
  hidden: { y: -10, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.3 } },
};

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
  const dynamicTitle = `SynthoraAI – ${titlePreview}`;

  return (
    <>
      <Head>
        <title>{dynamicTitle}</title>
      </Head>

      <div className="page-wrapper">
        <ArticleDetail article={article} />

        <motion.div
          className="action-buttons"
          variants={buttonContainer}
          initial="hidden"
          animate="show"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <motion.button
              className={`action-btn ${copied ? "copied" : ""}`}
              onClick={copyAll}
              title="Copy all article info"
              variants={buttonItem}
            >
              {copied ? <MdCheck size={20} /> : <MdContentCopy size={20} />}
            </motion.button>
            <motion.button
              className="action-btn"
              onClick={shareEmail}
              title="Share via Email"
              variants={buttonItem}
            >
              <MdEmail size={20} />
            </motion.button>
            <motion.button
              className="action-btn"
              onClick={shareTwitter}
              title="Share on Twitter"
              variants={buttonItem}
            >
              <AiOutlineTwitter size={20} />
            </motion.button>
            <motion.button
              className="action-btn"
              onClick={shareLinkedIn}
              title="Share on LinkedIn"
              variants={buttonItem}
            >
              <AiFillLinkedin size={20} />
            </motion.button>
            <motion.button
              className="action-btn"
              onClick={shareFacebook}
              title="Share on Facebook"
              variants={buttonItem}
            >
              <FaFacebookF size={20} />
            </motion.button>
          </div>

          <Link href="/home" passHref legacyBehavior>
            <motion.a
              className="action-btn"
              title="Back to Home"
              variants={buttonItem}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MdHome size={20} />
            </motion.a>
          </Link>
        </motion.div>

        <Comments articleId={article._id} />

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
