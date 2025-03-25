import { GetServerSideProps } from "next";
import Head from "next/head";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
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

export default function HomePage({
  topArticles,
  latestArticles,
}: HomePageProps) {
  const router = useRouter();

  // Use router query to pre-select topic and query if provided.
  const initialTopic =
    typeof router.query.topic === "string" ? router.query.topic : "";
  const initialSearch =
    typeof router.query.q === "string" ? router.query.q : "";

  // Live state for search query and topic selection.
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);

  // Whenever the query parameters change, update state.
  useEffect(() => {
    if (typeof router.query.topic === "string") {
      setSelectedTopic(router.query.topic);
    }
    if (typeof router.query.q === "string") {
      setSearchQuery(router.query.q);
    }
  }, [router.query]);

  // When on the root path "/", clear search state.
  useEffect(() => {
    if (router.asPath === "/") {
      setSearchQuery("");
      setSelectedTopic("");
    }
  }, [router.asPath]);

  // Toggle search mode if either search query or topic is provided.
  const isSearchActive =
    searchQuery.trim() !== "" || selectedTopic.trim() !== "";

  // Handler to clear search and topic.
  const handleClearSearch = () => {
    setSearchQuery("");
    setSelectedTopic("");
    router.push("/", undefined, { shallow: true });
  };

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
                `/?q=${encodeURIComponent(e.target.value)}&topic=${encodeURIComponent(selectedTopic)}`,
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
                `/?q=${encodeURIComponent(searchQuery)}&topic=${encodeURIComponent(topic)}`,
                undefined,
                { shallow: true },
              );
            }}
          />
        </div>

        {isSearchActive ? (
          // Display search results when either search query or topic is provided.
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
              <LatestArticles articles={latestArticles} />
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

export const getServerSideProps: GetServerSideProps<HomePageProps> = async ({
  res,
}) => {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=59",
  );
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
    };
  } catch (error) {
    console.error("Error fetching articles:", error);
    return { props: { topArticles: [], latestArticles: [] } };
  }
};
