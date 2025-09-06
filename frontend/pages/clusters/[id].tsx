import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Cluster } from "../../components/ClusterCard";
import {
  MdArrowBack,
  MdAccessTime,
  MdGroup,
  MdSource,
  MdShare,
  MdOutlineArrowForwardIos,
} from "react-icons/md";

interface ClusterEvent {
  _id: string;
  clusterId: string;
  articleId: any; // Populated article
  ts: string;
  kind: 'first_report' | 'official' | 'update' | 'analysis';
  note?: string;
}

interface Article {
  _id: string;
  title: string;
  url: string;
  source: string;
  fetchedAt: string;
  summary?: string;
}

interface ClusterDetailResponse {
  cluster: Omit<Cluster, 'articleIds'> & {
    articleIds: Article[]; // Populated articles
  };
  events: ClusterEvent[];
  timeline: ClusterEvent[];
}

const CLUSTERS_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

const eventKindLabels = {
  first_report: "First Report",
  official: "Official Statement", 
  update: "Update",
  analysis: "Analysis"
};

const eventKindColors = {
  first_report: "#28a745",
  official: "#dc3545", 
  update: "#007bff",
  analysis: "#6c757d"
};

export default function ClusterDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [cluster, setCluster] = useState<ClusterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'timeline' | 'articles'>('timeline');

  useEffect(() => {
    if (!id) return;

    fetchClusterDetail(id as string);
  }, [id]);

  const fetchClusterDetail = async (clusterId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${CLUSTERS_API_URL}/api/clusters/${clusterId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ClusterDetailResponse = await response.json();
      setCluster(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching cluster detail:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch cluster details");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const formatDateShort = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const groupEventsByDate = (events: ClusterEvent[]) => {
    const grouped: Record<string, ClusterEvent[]> = {};
    
    events.forEach(event => {
      const date = formatDateShort(event.ts);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });

    return grouped;
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: cluster?.cluster.canonicalTitle,
          text: cluster?.cluster.summary,
          url: window.location.href,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link copied to clipboard!");
      } catch (err) {
        console.log("Error copying to clipboard:", err);
      }
    }
  };

  if (loading) {
    return (
      <div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading cluster details...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            color: var(--text-secondary, #666);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--border-light, #f0f0f0);
            border-top-color: var(--primary-color, #007bff);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="error-container">
          <h2>Error Loading Cluster</h2>
          <p>{error}</p>
          <button onClick={() => router.back()} className="back-btn">
            Go Back
          </button>
        </div>
        <style jsx>{`
          .error-container {
            text-align: center;
            padding: 60px 20px;
            color: var(--error-text, #721c24);
          }
          .back-btn {
            padding: 10px 20px;
            background: var(--primary-color, #007bff);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
          }
        `}</style>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div>
        <div className="not-found">
          <h2>Cluster Not Found</h2>
          <Link href="/clusters">
            <a className="back-link">← Back to Clusters</a>
          </Link>
        </div>
      </div>
    );
  }

  const { cluster: clusterData, events } = cluster;
  const groupedEvents = groupEventsByDate(events);
  const sourceNames = Object.keys(clusterData.sourceCounts || {});

  return (
    <div>
      <Head>
        <title>{clusterData.canonicalTitle} - AI Gov Content Curator</title>
        <meta name="description" content={clusterData.summary} />
      </Head>

      <div className="cluster-detail">
        {/* Header */}
        <div className="cluster-header">
          <div className="header-actions">
            <Link href="/clusters">
              <a className="back-link">
                <MdArrowBack size={20} />
                Back to Clusters
              </a>
            </Link>
            <button onClick={handleShare} className="share-btn">
              <MdShare size={18} />
              Share
            </button>
          </div>

          <h1 className="cluster-title">{clusterData.canonicalTitle}</h1>
          
          <div className="cluster-meta">
            <div className="meta-item">
              <MdGroup size={18} />
              <span>{clusterData.quality?.size || clusterData.articleIds?.length || 0} articles</span>
            </div>
            <div className="meta-item">
              <MdSource size={18} />
              <span>{sourceNames.length} sources</span>
            </div>
            <div className="meta-item">
              <MdAccessTime size={18} />
              <span>Updated {formatDateShort(clusterData.lastUpdated)}</span>
            </div>
          </div>

          {clusterData.summary && (
            <div className="cluster-summary">
              <p>{clusterData.summary}</p>
            </div>
          )}

          {/* Entity chips */}
          <div className="entity-section">
            {clusterData.entityBag?.topics && clusterData.entityBag.topics.length > 0 && (
              <div className="entity-group">
                <span className="entity-label">Topics:</span>
                <div className="entity-chips">
                  {clusterData.entityBag.topics.map((topic, index) => (
                    <span key={index} className="entity-chip entity-topic">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {clusterData.entityBag?.orgs && clusterData.entityBag.orgs.length > 0 && (
              <div className="entity-group">
                <span className="entity-label">Organizations:</span>
                <div className="entity-chips">
                  {clusterData.entityBag.orgs.map((org, index) => (
                    <span key={index} className="entity-chip entity-org">
                      {org}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {clusterData.entityBag?.places && clusterData.entityBag.places.length > 0 && (
              <div className="entity-group">
                <span className="entity-label">Places:</span>
                <div className="entity-chips">
                  {clusterData.entityBag.places.map((place, index) => (
                    <span key={index} className="entity-chip entity-place">
                      {place}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="tab-navigation">
          <button
            className={`tab ${selectedTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setSelectedTab('timeline')}
          >
            Timeline ({events.length})
          </button>
          <button
            className={`tab ${selectedTab === 'articles' ? 'active' : ''}`}
            onClick={() => setSelectedTab('articles')}
          >
            Articles ({clusterData.articleIds?.length || 0})
          </button>
        </div>

        {/* Content */}
        <div className="cluster-content">
          {selectedTab === 'timeline' ? (
            <div className="timeline">
              {events.length === 0 ? (
                <div className="empty-timeline">
                  <p>No timeline events available for this cluster.</p>
                </div>
              ) : (
                Object.entries(groupedEvents).map(([date, dateEvents]) => (
                  <div key={date} className="timeline-date-group">
                    <h3 className="timeline-date">{date}</h3>
                    <div className="timeline-events">
                      {dateEvents.map((event) => (
                        <div key={event._id} className="timeline-event">
                          <div 
                            className="event-indicator"
                            style={{ backgroundColor: eventKindColors[event.kind] }}
                          ></div>
                          <div className="event-content">
                            <div className="event-header">
                              <span 
                                className="event-kind"
                                style={{ color: eventKindColors[event.kind] }}
                              >
                                {eventKindLabels[event.kind]}
                              </span>
                              <span className="event-time">
                                {formatDate(event.ts)}
                              </span>
                            </div>
                            {event.articleId && (
                              <div className="event-article">
                                <Link href={`/articles/${event.articleId._id}`}>
                                  <a className="event-article-link">
                                    {event.articleId.title}
                                    <MdOutlineArrowForwardIos size={14} />
                                  </a>
                                </Link>
                                <p className="event-article-source">
                                  Source: {event.articleId.source}
                                </p>
                              </div>
                            )}
                            {event.note && (
                              <p className="event-note">{event.note}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="articles-list">
              {clusterData.articleIds?.length === 0 ? (
                <div className="empty-articles">
                  <p>No articles found in this cluster.</p>
                </div>
              ) : (
                clusterData.articleIds?.map((article) => (
                  <div key={article._id} className="article-item">
                    <div className="article-content">
                      <Link href={`/articles/${article._id}`}>
                        <a className="article-title-link">
                          <h3 className="article-title">{article.title}</h3>
                        </a>
                      </Link>
                      {article.summary && (
                        <p className="article-summary">{article.summary}</p>
                      )}
                      <div className="article-meta">
                        <span className="article-source">
                          Source: {article.source}
                        </span>
                        <span className="article-date">
                          {formatDateShort(article.fetchedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="article-actions">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="external-link"
                      >
                        View Original
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <style jsx>{`
          .cluster-detail {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
          }

          .cluster-header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--border-light, #f0f0f0);
          }

          .header-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .back-link {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--primary-color, #007bff);
            text-decoration: none;
            font-weight: 500;
          }

          .back-link:hover {
            color: var(--primary-hover, #0056b3);
          }

          .share-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: var(--card-bg, white);
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 6px;
            padding: 8px 16px;
            color: var(--text-secondary, #666);
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s ease;
          }

          .share-btn:hover {
            border-color: var(--primary-color, #007bff);
            color: var(--primary-color, #007bff);
          }

          .cluster-title {
            font-size: 2.25rem;
            font-weight: 700;
            color: var(--text-primary, #333);
            margin: 0 0 16px 0;
            line-height: 1.3;
          }

          .cluster-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 20px;
          }

          .meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-secondary, #666);
            font-size: 0.95rem;
          }

          .cluster-summary {
            margin-bottom: 20px;
          }

          .cluster-summary p {
            font-size: 1.1rem;
            line-height: 1.6;
            color: var(--text-secondary, #666);
            margin: 0;
          }

          .entity-section {
            margin-top: 20px;
          }

          .entity-group {
            margin-bottom: 12px;
          }

          .entity-label {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-tertiary, #999);
            margin-right: 10px;
          }

          .entity-chips {
            display: inline-flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .entity-chip {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 0.8rem;
            font-weight: 500;
          }

          .entity-topic {
            background: #e3f2fd;
            color: #1976d2;
          }

          .entity-org {
            background: #f3e5f5;
            color: #7b1fa2;
          }

          .entity-place {
            background: #e8f5e8;
            color: #388e3c;
          }

          .tab-navigation {
            display: flex;
            border-bottom: 2px solid var(--border-light, #f0f0f0);
            margin-bottom: 30px;
          }

          .tab {
            padding: 12px 24px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            color: var(--text-secondary, #666);
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .tab:hover {
            color: var(--text-primary, #333);
          }

          .tab.active {
            color: var(--primary-color, #007bff);
            border-bottom-color: var(--primary-color, #007bff);
          }

          .cluster-content {
            min-height: 400px;
          }

          .timeline {
            margin-left: 20px;
          }

          .timeline-date-group {
            margin-bottom: 30px;
          }

          .timeline-date {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-primary, #333);
            margin: 0 0 16px 0;
            padding-left: 40px;
          }

          .timeline-events {
            position: relative;
          }

          .timeline-events::before {
            content: '';
            position: absolute;
            left: 15px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: var(--border-color, #e0e0e0);
          }

          .timeline-event {
            position: relative;
            display: flex;
            margin-bottom: 20px;
          }

          .event-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 20px;
            margin-top: 6px;
            flex-shrink: 0;
            border: 3px solid white;
            box-shadow: 0 0 0 2px var(--border-color, #e0e0e0);
          }

          .event-content {
            flex: 1;
            background: var(--card-bg, white);
            border: 1px solid var(--border-light, #f0f0f0);
            border-radius: 8px;
            padding: 16px;
          }

          .event-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }

          .event-kind {
            font-weight: 600;
            font-size: 0.9rem;
          }

          .event-time {
            font-size: 0.8rem;
            color: var(--text-tertiary, #999);
          }

          .event-article {
            margin-bottom: 8px;
          }

          .event-article-link {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-primary, #333);
            text-decoration: none;
            font-weight: 500;
            margin-bottom: 4px;
          }

          .event-article-link:hover {
            color: var(--primary-color, #007bff);
          }

          .event-article-source {
            font-size: 0.8rem;
            color: var(--text-secondary, #666);
            margin: 0;
          }

          .event-note {
            font-size: 0.9rem;
            color: var(--text-secondary, #666);
            margin: 0;
            font-style: italic;
          }

          .articles-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .article-item {
            display: flex;
            background: var(--card-bg, white);
            border: 1px solid var(--border-light, #f0f0f0);
            border-radius: 8px;
            padding: 20px;
            transition: border-color 0.2s ease;
          }

          .article-item:hover {
            border-color: var(--border-color, #e0e0e0);
          }

          .article-content {
            flex: 1;
          }

          .article-title-link {
            text-decoration: none;
          }

          .article-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-primary, #333);
            margin: 0 0 8px 0;
            line-height: 1.4;
          }

          .article-title-link:hover .article-title {
            color: var(--primary-color, #007bff);
          }

          .article-summary {
            color: var(--text-secondary, #666);
            line-height: 1.5;
            margin: 0 0 12px 0;
            max-width: none;
          }

          .article-meta {
            display: flex;
            gap: 16px;
            font-size: 0.85rem;
            color: var(--text-tertiary, #999);
          }

          .article-actions {
            margin-left: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .external-link {
            padding: 8px 16px;
            background: var(--primary-color, #007bff);
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: 500;
            text-align: center;
            transition: background-color 0.2s ease;
          }

          .external-link:hover {
            background: var(--primary-hover, #0056b3);
          }

          .empty-timeline,
          .empty-articles {
            text-align: center;
            padding: 60px 20px;
            color: var(--text-secondary, #666);
          }

          @media (max-width: 768px) {
            .cluster-detail {
              padding: 15px;
            }

            .cluster-title {
              font-size: 1.8rem;
            }

            .cluster-meta {
              flex-direction: column;
              gap: 8px;
            }

            .header-actions {
              flex-direction: column;
              gap: 12px;
              align-items: stretch;
            }

            .timeline {
              margin-left: 10px;
            }

            .timeline-date {
              padding-left: 30px;
            }

            .article-item {
              flex-direction: column;
              gap: 16px;
            }

            .article-actions {
              margin-left: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}