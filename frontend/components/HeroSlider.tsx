// @ts-nocheck
import React from "react";
import Slider from "react-slick";
import { Article } from "../pages/home";
import { MdLibraryBooks } from "react-icons/md";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface HeroSliderProps {
  articles: Article[];
}

export default function HeroSlider({ articles }: HeroSliderProps) {
  // If no articles, render nothing or a placeholder
  if (!articles || articles.length === 0) {
    return (
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        No top articles for slider.
      </div>
    );
  }

  const settings = {
    dots: true,
    infinite: true,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    fade: true,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: true,
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <Slider {...settings}>
        {articles.map((article, index) => (
          <div key={index} style={{ position: "relative", height: "300px" }}>
            {/* Background with some style */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(to bottom right, #0066cc, #003399)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                color: "#fff",
                textAlign: "center",
                padding: "1rem",
                borderRadius: "4px",
              }}
            >
              <MdLibraryBooks size={50} style={{ marginBottom: "0.5rem" }} />
              <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                {article.title}
              </h2>
              <p style={{ fontSize: "1rem", maxWidth: "600px" }}>
                {article.summary?.slice(0, 140) +
                  (article.summary?.length > 140 ? "..." : "")}
              </p>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
}
