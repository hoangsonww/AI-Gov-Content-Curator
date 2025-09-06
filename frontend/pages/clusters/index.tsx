import React, { useState, useEffect } from "react";
import Head from "next/head";
import ClusterCard, { Cluster } from "../../components/ClusterCard";
import { MdSearch, MdRefresh } from "react-icons/md";

interface ClustersResponse {
  data: Cluster[];
  total: number;
  page: number;
  limit: number;
}

const CLUSTERS_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function ClustersPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const limit = 10;

  const fetchClusters = async (pageNum: number = 1, search: string = "") => {
    try {
      setLoading(pageNum === 1);
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });

      if (search.trim()) {
        // For now, we'll implement client-side filtering
        // In the future, this could be server-side search
      }

      const response = await fetch(`${CLUSTERS_API_URL}/api/clusters?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ClustersResponse = await response.json();
      
      // Client-side filtering by search term
      let filteredClusters = data.data;
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        filteredClusters = data.data.filter(cluster =>
          cluster.canonicalTitle.toLowerCase().includes(searchLower) ||
          cluster.summary.toLowerCase().includes(searchLower) ||
          cluster.entityBag.topics.some(topic => topic.toLowerCase().includes(searchLower)) ||
          cluster.entityBag.orgs.some(org => org.toLowerCase().includes(searchLower))
        );
      }

      if (pageNum === 1) {
        setClusters(filteredClusters);
      } else {
        setClusters(prev => [...prev, ...filteredClusters]);
      }

      setTotalPages(Math.ceil(data.total / limit));
      setPage(pageNum);
      setError(null);
    } catch (err) {
      console.error("Error fetching clusters:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch clusters");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClusters(1, searchTerm);
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== "") {
        fetchClusters(1, searchTerm);
      } else {
        fetchClusters(1);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const handleLoadMore = () => {
    if (page < totalPages && !loading) {
      fetchClusters(page + 1, searchTerm);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClusters(1, searchTerm);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  return (
    <div>
      <Head>
        <title>Article Clusters - AI Gov Content Curator</title>
        <meta
          name="description"
          content="Explore grouped government articles organized by topic and similarity"
        />
      </Head>

      <div className="clusters-page">
        <div className="clusters-header">
          <div className="header-content">
            <h1>Article Clusters</h1>
            <p className="header-description">
              Explore government articles grouped by topic and content similarity.
              Each cluster represents multiple related articles from different sources.
            </p>
          </div>

          <div className="search-and-actions">
            <div className="search-box">
              <MdSearch className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search clusters by title, content, or topics..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-input"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="clear-search">
                  ×
                </button>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="refresh-btn"
              title="Refresh clusters"
            >
              <MdRefresh className={refreshing ? "spinning" : ""} size={20} />
            </button>
          </div>
        </div>

        <div className="clusters-content">
          {error && (
            <div className="error-message">
              <p>Error loading clusters: {error}</p>
              <button onClick={() => fetchClusters(1, searchTerm)} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {loading && clusters.length === 0 ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading clusters...</p>
            </div>
          ) : clusters.length === 0 ? (
            <div className="empty-state">
              <h3>No clusters found</h3>
              {searchTerm ? (
                <p>Try adjusting your search terms or <button onClick={clearSearch} className="link-btn">clear the search</button>.</p>
              ) : (
                <p>No article clusters are available yet. Check back later!</p>
              )}
            </div>
          ) : (
            <>
              <div className="clusters-list">
                {clusters.map((cluster) => (
                  <ClusterCard key={cluster._id} cluster={cluster} />
                ))}
              </div>

              {page < totalPages && (
                <div className="load-more-container">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="load-more-btn"
                  >
                    {loading ? "Loading..." : "Load More Clusters"}
                  </button>
                </div>
              )}

              {clusters.length > 0 && (
                <div className="results-info">
                  Showing {clusters.length} clusters (Page {page} of {totalPages})
                </div>
              )}
            </>
          )}
        </div>

        <style jsx>{`
          .clusters-page {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }

          .clusters-header {
            margin-bottom: 30px;
          }

          .header-content {
            margin-bottom: 20px;
          }

          .header-content h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text-primary, #333);
            margin: 0 0 10px 0;
          }

          .header-description {
            font-size: 1.1rem;
            color: var(--text-secondary, #666);
            line-height: 1.5;
            margin: 0;
          }

          .search-and-actions {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .search-box {
            position: relative;
            flex: 1;
            max-width: 500px;
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary, #999);
          }

          .search-input {
            width: 100%;
            padding: 12px 12px 12px 44px;
            border: 2px solid var(--border-color, #e0e0e0);
            border-radius: 8px;
            font-size: 1rem;
            background: var(--input-bg, white);
            color: var(--text-primary, #333);
            transition: border-color 0.2s ease;
          }

          .search-input:focus {
            outline: none;
            border-color: var(--primary-color, #007bff);
          }

          .clear-search {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 1.5rem;
            color: var(--text-tertiary, #999);
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .clear-search:hover {
            color: var(--text-secondary, #666);
          }

          .refresh-btn {
            padding: 12px;
            border: 2px solid var(--border-color, #e0e0e0);
            border-radius: 8px;
            background: var(--card-bg, white);
            color: var(--text-secondary, #666);
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .refresh-btn:hover {
            border-color: var(--primary-color, #007bff);
            color: var(--primary-color, #007bff);
          }

          .refresh-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .spinning {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .clusters-content {
            min-height: 400px;
          }

          .error-message {
            text-align: center;
            padding: 40px 20px;
            background: var(--error-bg, #f8d7da);
            border: 1px solid var(--error-border, #f5c6cb);
            border-radius: 8px;
            color: var(--error-text, #721c24);
          }

          .retry-btn {
            margin-top: 10px;
            padding: 8px 16px;
            background: var(--primary-color, #007bff);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
          }

          .retry-btn:hover {
            background: var(--primary-hover, #0056b3);
          }

          .loading-container {
            text-align: center;
            padding: 60px 20px;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--border-light, #f0f0f0);
            border-top-color: var(--primary-color, #007bff);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }

          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-secondary, #666);
          }

          .empty-state h3 {
            color: var(--text-primary, #333);
            margin-bottom: 10px;
          }

          .link-btn {
            background: none;
            border: none;
            color: var(--primary-color, #007bff);
            text-decoration: underline;
            cursor: pointer;
            font-size: inherit;
          }

          .link-btn:hover {
            color: var(--primary-hover, #0056b3);
          }

          .clusters-list {
            margin-bottom: 30px;
          }

          .load-more-container {
            text-align: center;
            margin-bottom: 20px;
          }

          .load-more-btn {
            padding: 12px 24px;
            background: var(--primary-color, #007bff);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          .load-more-btn:hover {
            background: var(--primary-hover, #0056b3);
          }

          .load-more-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .results-info {
            text-align: center;
            color: var(--text-tertiary, #999);
            font-size: 0.9rem;
          }

          @media (max-width: 768px) {
            .clusters-page {
              padding: 15px;
            }

            .header-content h1 {
              font-size: 2rem;
            }

            .search-and-actions {
              flex-direction: column;
              align-items: stretch;
            }

            .search-box {
              max-width: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}