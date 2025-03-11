import { GetServerSideProps } from "next";
import LatestArticles from "../components/LatestArticles";
import AllArticles from "../components/AllArticles";
import { getTopArticles, getLatestArticles } from "../services/api";

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
  topArticles: Article[];
  latestArticles: Article[];
}

export default function HomePage({
  topArticles,
  latestArticles,
}: HomePageProps) {
  return (
    <>
      <div style={{ marginBottom: "2rem" }}>
        <h1 className="page-title">Latest Articles</h1>
        {/* Optionally, if you want to have a hero slider for top articles:
            <div className="hero-slider-container">
              <HeroSlider articles={topArticles} />
            </div>
        */}
        <div className="latest-articles-container">
          <LatestArticles articles={latestArticles} />
        </div>
        <hr style={{ margin: "2rem 0" }} />
        <div className="all-articles-container">
          <AllArticles />
        </div>
      </div>

      <style jsx>{`
        .page-title {
          font-weight: 700;
          margin-bottom: 1rem;
          animation: fadeDown 1s ease-out;
        }
        .latest-articles-container,
        .all-articles-container {
          animation: fadeIn 1s ease;
        }
        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Fetch top 5 and then next 10 articles from the API service
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
    return {
      props: {
        topArticles: [],
        latestArticles: [],
      },
    };
  }
};
