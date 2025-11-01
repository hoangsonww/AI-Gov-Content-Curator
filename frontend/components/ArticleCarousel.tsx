import React, { useState } from "react";
import Slider from "react-slick";
import { Article } from "../pages/home";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import ArticleCard from "./ArticleCard";

interface ArticleCarouselProps {
  articles: Article[];
  autoRotateInterval?: number;
  direction?: "left" | "right";
  initialIndex?: number;
}

export default function ArticleCarousel({
  articles,
  autoRotateInterval = 3000,
  direction = "left",
  initialIndex,
}: ArticleCarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });

  const truncateSummary = (text: string, maxLength: number = 250) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  const handleTopicClick = (e: React.MouseEvent, topic: string) => {
    e.stopPropagation();
    if (!isDragging) {
      window.location.href = `/home?topic=${encodeURIComponent(topic)}`;
    }
  };

  const handleCardMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  };

  const handleCardMouseMove = (e: React.MouseEvent) => {
    const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
    if (deltaX > 5 || deltaY > 5) {
      setIsDragging(true);
    }
  };

  const handleCardMouseUp = () => {
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleCardClick = (e: React.MouseEvent, articleId: string) => {
    e.preventDefault();
    if (!isDragging) {
      window.location.href = `/articles/${articleId}`;
    }
  };

  const getVisibleTopics = (topics: string[]) => {
    if (!topics || topics.length === 0) return [];
    const maxTopics = 2;
    return topics.slice(0, maxTopics);
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  const sliderSettings = {
    dots: true,
    infinite: articles.length > 3,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: autoRotateInterval,
    pauseOnHover: true,
    rtl: direction === "right",
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          rtl: direction === "right",
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
          rtl: direction === "right",
        },
      },
    ],
  };

  return (
    <>
      {/* Mobile: Regular grid */}
      <div className="mobile-grid">
        {articles.map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>

      {/* Desktop/Tablet: Slider Carousel */}
      <div className="article-carousel-section">
        <div className="carousel-wrapper">
          <Slider {...sliderSettings}>
            {articles.map((article) => (
              <div key={article._id} className="carousel-slide">
                <div
                  className="carousel-card"
                  onMouseDown={handleCardMouseDown}
                  onMouseMove={handleCardMouseMove}
                  onMouseUp={handleCardMouseUp}
                  onClick={(e) => handleCardClick(e, article._id)}
                >
                  <h3 className="carousel-card-title">{article.title}</h3>

                  {article.summary && (
                    <div className="carousel-card-summary">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {truncateSummary(article.summary)}
                      </ReactMarkdown>
                    </div>
                  )}

                  {article.topics && article.topics.length > 0 && (
                    <div className="carousel-card-topics">
                      {getVisibleTopics(article.topics).map((topic, idx) => (
                        <span
                          key={idx}
                          className="carousel-topic-badge carousel-topic-badge-clickable"
                          onClick={(e) => handleTopicClick(e, topic)}
                        >
                          {topic}
                        </span>
                      ))}
                      {article.topics.length > 2 && (
                        <span className="carousel-topic-badge carousel-topic-more">
                          +{article.topics.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="carousel-card-readmore">Read More →</div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </>
  );
}
