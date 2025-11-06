import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { MdTrendingUp, MdSource, MdTopic, MdStar, MdLightbulb, MdCalendarToday } from "react-icons/md";

// Color palette for charts
const COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

interface SourceDistribution {
  source: string;
  count: number;
  percentage: string;
  [key: string]: any;
}

interface TopicTrend {
  topic: string;
  data: { period: string; count: number }[];
  total: number;
}

interface BiasTrend {
  source: string;
  articles: number;
  biasScore: number;
  biasLabel: string;
}

interface TopRatedArticle {
  article: {
    _id: string;
    title: string;
    source: string;
    topics: string[];
    fetchedAt: string;
    url: string;
  };
  averageRating: number;
  totalRatings: number;
}

interface AnalyticsInsights {
  summary: string;
  stats?: {
    totalArticles: number;
    sources: string[];
    topTopics: string[];
    period: string;
  };
  aiGenerated: boolean;
}

export default function Dashboard() {
  const [sourceData, setSourceData] = useState<SourceDistribution[]>([]);
  const [topicTrends, setTopicTrends] = useState<TopicTrend[]>([]);
  const [biasTrends, setBiasTrends] = useState<BiasTrend[]>([]);
  const [topRated, setTopRated] = useState<TopRatedArticle[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date range filters
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [days, setDays] = useState<number>(7);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  useEffect(() => {
    fetchAllData();
  }, [dateRange, days]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append("startDate", dateRange.startDate);
      if (dateRange.endDate) params.append("endDate", dateRange.endDate);
      
      const [sourceRes, topicRes, biasRes, topRatedRes, insightsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/analytics/source-distribution?${params}`),
        fetch(`${API_BASE_URL}/api/analytics/topic-trends?${params}&interval=day`),
        fetch(`${API_BASE_URL}/api/analytics/bias-trends?${params}`),
        fetch(`${API_BASE_URL}/api/analytics/top-rated?limit=5&${params}`),
        fetch(`${API_BASE_URL}/api/analytics/insights?days=${days}`),
      ]);

      if (!sourceRes.ok || !topicRes.ok || !biasRes.ok || !topRatedRes.ok || !insightsRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const [sourceJson, topicJson, biasJson, topRatedJson, insightsJson] = await Promise.all([
        sourceRes.json(),
        topicRes.json(),
        biasRes.json(),
        topRatedRes.json(),
        insightsRes.json(),
      ]);

      setSourceData(sourceJson.data || []);
      setTopicTrends(topicJson.data || []);
      setBiasTrends(biasJson.data || []);
      setTopRated(topRatedJson.data || []);
      setInsights(insightsJson.data || null);
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (numDays: number) => {
    setDays(numDays);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays);
    
    setDateRange({
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });
  };

  const clearFilters = () => {
    setDateRange({ startDate: "", endDate: "" });
    setDays(7);
  };

  return (
    <>
      <Head>
        <title>Analytics Dashboard - SynthoraAI</title>
        <meta name="description" content="View trends, insights, and analytics for curated government content" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
              <MdTrendingUp className="text-blue-600 dark:text-blue-400" />
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Visualize article trends, topics, sources, and insights
            </p>
          </div>

          {/* Filter Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <MdCalendarToday className="text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Filters</h2>
            </div>
            
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickFilter(7)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => handleQuickFilter(30)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-300">Loading analytics...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* AI Insights Section */}
              {insights && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg shadow-md p-6 mb-8 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-4">
                    <MdLightbulb className="text-2xl text-purple-600 dark:text-purple-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      AI-Generated Insights
                      {insights.aiGenerated && (
                        <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">AI</span>
                      )}
                    </h2>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{insights.summary}</p>
                  {insights.stats && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Articles</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{insights.stats.totalArticles}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Active Sources</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{insights.stats.sources.length}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Top Topics</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{insights.stats.topTopics.length}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Source Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MdSource className="text-2xl text-blue-600 dark:text-blue-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Source Distribution</h2>
                  </div>
                  {sourceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={sourceData}
                          dataKey="count"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.source} (${entry.percentage}%)`}
                        >
                          {sourceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                  )}
                </div>

                {/* Topic Trends */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MdTopic className="text-2xl text-green-600 dark:text-green-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Topic Trends Over Time</h2>
                  </div>
                  {topicTrends.length > 0 && topicTrends[0].data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={topicTrends[0].data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {topicTrends.slice(0, 5).map((trend, index) => (
                          <Line
                            key={trend.topic}
                            type="monotone"
                            data={trend.data}
                            dataKey="count"
                            name={trend.topic}
                            stroke={COLORS[index % COLORS.length]}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                  )}
                </div>
              </div>

              {/* Source Article Count Bar Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <MdSource className="text-2xl text-amber-600 dark:text-amber-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Articles by Source</h2>
                </div>
                {biasTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={biasTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="articles" fill="#3B82F6" name="Article Count" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data available</p>
                )}
              </div>

              {/* Top Rated Articles */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MdStar className="text-2xl text-amber-500 dark:text-amber-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Top Rated Articles</h2>
                </div>
                {topRated.length > 0 ? (
                  <div className="space-y-4">
                    {topRated.map((item, index) => (
                      <Link key={item.article._id} href={`/articles/${item.article._id}`}>
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                                  {item.article.title}
                                </h3>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Source: <span className="font-medium">{item.article.source}</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {item.article.topics.slice(0, 3).map((topic) => (
                                  <span
                                    key={topic}
                                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded"
                                  >
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-amber-500">
                                <MdStar className="text-xl" />
                                <span className="text-2xl font-bold">{item.averageRating.toFixed(1)}</span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {item.totalRatings} rating{item.totalRatings !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No rated articles yet</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
