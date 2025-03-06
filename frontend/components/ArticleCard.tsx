import Link from "next/link";
import { Article } from "../pages";
import React from "react";
import { MdOutlineArrowForwardIos } from "react-icons/md";

const ArrowIcon = MdOutlineArrowForwardIos as React.FC<{ size?: number }>;

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  return (
    <div className="article-card hover-animate">
      <h2 className="article-title">{article.title}</h2>
      {article.summary && <p className="article-summary">{article.summary}</p>}
      <p className="article-source">Source: {article.source}</p>

      <Link href={`/articles/${article._id}`}>
        <span className="article-readmore">
          Read More <ArrowIcon size={14} />
        </span>
      </Link>
    </div>
  );
}
