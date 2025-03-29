import { GetStaticProps } from "next";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";
import LatestArticles from "../components/LatestArticles";
import AllArticles from "../components/AllArticles";
import ArticleSearch from "../components/ArticleSearch";
import TopicDropdown from "../components/TopicDropdown";
import { getTopArticles, getLatestArticles } from "../services/api";

export interface Article {
  _id: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  topics: string[];
  source: string;
  fetchedAt: string;
}

interface HomePageProps {
  topArticles: Article[];
  latestArticles: Article[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function HomePage({
  topArticles,
  latestArticles,
}: HomePageProps) {
  const router = useRouter();
  const initialTopic =
    typeof router.query.topic === "string" ? router.query.topic : "";
  const initialSearch =
    typeof router.query.q === "string" ? router.query.q : "";

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);

  useEffect(() => {
    if (typeof router.query.topic === "string") {
      setSelectedTopic(router.query.topic);
    }
    if (typeof router.query.q === "string") {
      setSearchQuery(router.query.q);
    }
  }, [router.query]);

  useEffect(() => {
    if (router.asPath === "/") {
      setSearchQuery("");
      setSelectedTopic("");
    }
  }, [router.asPath]);

  const isSearchActive =
    searchQuery.trim() !== "" || selectedTopic.trim() !== "";

  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedTopic("");
    router.push("/", undefined, { shallow: true });
  };

  // Use SWR to fetch the most recent "latest articles" data.
  // The initial data is provided from ISR, then SWR updates in the background.
  const { data: liveLatestArticles } = useSWR("/api/latestArticles", fetcher, {
    fallbackData: latestArticles,
    refreshInterval: 10000, // refresh every 10 seconds (adjust as needed)
  });

  return (
    <>
      <Head>
        <title>Article Curator - AI-Powered News Article Content Curator</title>
      </Head>
      <div style={{ marginBottom: "2rem" }}>
        {/* SEARCH BAR & TOPIC DROPDOWN */}
        <div className="search-container fade-down">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              router.push(
                `/?q=${encodeURIComponent(
                  e.target.value,
                )}&topic=${encodeURIComponent(selectedTopic)}`,
                undefined,
                { shallow: true },
              );
            }}
            className="search-input"
          />
          <TopicDropdown
            selectedTopic={selectedTopic}
            onChange={(topic) => {
              setSelectedTopic(topic);
              router.push(
                `/?q=${encodeURIComponent(
                  searchQuery,
                )}&topic=${encodeURIComponent(topic)}`,
                undefined,
                { shallow: true },
              );
            }}
          />
        </div>

        {isSearchActive ? (
          <ArticleSearch
            query={searchQuery}
            topic={selectedTopic}
            onClear={handleClearSearch}
          />
        ) : (
          <>
            <h1 className="page-title">Latest Articles ✨</h1>
            <p
              className="subtitle fade-down"
              style={{ textAlign: "center", marginBottom: "1.5rem" }}
            >
              Freshly gathered, thoughtfully summarized.
            </p>
            <div className="latest-articles-container">
              <LatestArticles articles={liveLatestArticles} />
            </div>
            <hr style={{ margin: "2rem 0" }} />
            <div className="all-articles-container">
              <AllArticles />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  try {
    const [topData, latestData] = await Promise.all([
      getTopArticles(),
      getLatestArticles(),
    ]);
    return {
      props: {
        topArticles: topData,
        latestArticles: latestData,
      },
      revalidate: 60, // Regenerate this page every 60 seconds
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return { props: { topArticles: [], latestArticles: [] } };
  }
};
