import { GetServerSideProps } from "next";
import { useState, useEffect } from "react";
import LatestArticles from "../components/LatestArticles";
import AllArticles from "../components/AllArticles";

export interface Article {
  _id: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  source: string;
  fetchedAt: string;
}

interface HomePageProps {
  topArticles: Article[]; // for the slider
  latestArticles: Article[]; // for "Latest Articles"
}

export default function HomePage({
  topArticles,
  latestArticles,
}: HomePageProps) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      {/*<HeroSlider articles={topArticles} />*/}

      <h1 className="page-title">Latest Articles</h1>
      <LatestArticles articles={latestArticles} />

      <hr style={{ margin: "2rem 0" }} />

      <AllArticles />
    </div>
  );
}

// Using Server-Side Rendering (SSR) to fetch top articles for the slider and the latest 10 for the 'Latest Articles'
export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // 1) Fetch top 5 articles (or however your API defines 'top' articles)
    const topRes = await fetch(
      "https://ai-content-curator-backend.vercel.app/api/articles?page=1&limit=5",
    );
    if (!topRes.ok) throw new Error("Failed to fetch top articles");
    const { data: topData } = await topRes.json();

    // 2) Fetch the next 10 as 'latest'
    const latestRes = await fetch(
      "https://ai-content-curator-backend.vercel.app/api/articles?page=2&limit=10",
    );
    if (!latestRes.ok) throw new Error("Failed to fetch latest articles");
    const { data: latestData } = await latestRes.json();

    return {
      props: {
        topArticles: topData || [],
        latestArticles: latestData || [],
      },
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return {
      props: {
        topArticles: [],
        latestArticles: [],
      },
    };
  }
};
