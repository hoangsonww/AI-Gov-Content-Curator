import React from "react";
import Link from "next/link";
import { MdOutlineArrowForwardIos, MdGroup, MdAccessTime } from "react-icons/md";

export interface Cluster {
  _id: string;
  canonicalTitle: string;
  summary: string;
  entityBag: {
    persons: string[];
    orgs: string[];
    places: string[];
    topics: string[];
  };
  articleIds: string[];
  sourceCounts: Record<string, number>;
  firstSeen: string;
  lastUpdated: string;
  quality: {
    coherence: number;
    size: number;
  };
}

interface ClusterCardProps {
  cluster: Cluster;
  showSourcesCount?: boolean;
}

const ArrowIcon = MdOutlineArrowForwardIos as React.FC<{ size?: number }>;
const GroupIcon = MdGroup as React.FC<{ size?: number }>;
const TimeIcon = MdAccessTime as React.FC<{ size?: number }>;

export default function ClusterCard({ cluster, showSourcesCount = true }: ClusterCardProps) {
  const title = cluster.canonicalTitle?.trim() || "Cluster Title Unavailable";
  const sourceNames = Object.keys(cluster.sourceCounts || {});
  const totalArticles = cluster.quality?.size || cluster.articleIds?.length || 0;
  const totalSources = sourceNames.length;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getTopEntities = (entities: string[], max: number = 3) => {
    return entities.slice(0, max);
  };

  return (
    <div className="cluster-card hover-animate" style={{ position: "relative" }}>
      <div className="cluster-header">
        <h2 className="cluster-title">{title}</h2>
        {showSourcesCount && (
          <div className="cluster-badges">
            <div className="cluster-badge">
              <GroupIcon size={14} />
              <span>{totalArticles} articles</span>
            </div>
            <div className="cluster-badge">
              <span>+{totalSources} sources</span>
            </div>
          </div>
        )}
      </div>

      {cluster.summary && (
        <div className="cluster-summary">
          <p>{cluster.summary}</p>
        </div>
      )}

      {/* Entity chips */}
      <div className="entity-section">
        {cluster.entityBag?.topics && cluster.entityBag.topics.length > 0 && (
          <div className="entity-group">
            <span className="entity-label">Topics:</span>
            <div className="entity-chips">
              {getTopEntities(cluster.entityBag.topics).map((topic, index) => (
                <span key={index} className="entity-chip entity-topic">
                  {topic}
                </span>
              ))}
              {cluster.entityBag.topics.length > 3 && (
                <span className="entity-chip entity-more">
                  +{cluster.entityBag.topics.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {cluster.entityBag?.orgs && cluster.entityBag.orgs.length > 0 && (
          <div className="entity-group">
            <span className="entity-label">Organizations:</span>
            <div className="entity-chips">
              {getTopEntities(cluster.entityBag.orgs).map((org, index) => (
                <span key={index} className="entity-chip entity-org">
                  {org}
                </span>
              ))}
              {cluster.entityBag.orgs.length > 3 && (
                <span className="entity-chip entity-more">
                  +{cluster.entityBag.orgs.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sources preview */}
      {sourceNames.length > 0 && (
        <div className="cluster-sources">
          <span className="sources-label">Sources:</span>
          <div className="sources-list">
            {sourceNames.slice(0, 4).map((source, index) => (
              <span key={index} className="source-name">
                {source}
                {cluster.sourceCounts[source] > 1 && (
                  <span className="source-count">({cluster.sourceCounts[source]})</span>
                )}
              </span>
            ))}
            {sourceNames.length > 4 && (
              <span className="source-more">+{sourceNames.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      <div className="cluster-footer">
        <div className="cluster-meta">
          <TimeIcon size={14} />
          <span>Updated {formatDate(cluster.lastUpdated)}</span>
        </div>

        <Link href={`/clusters/${cluster._id}`}>
          <span className="cluster-readmore">
            View Timeline <ArrowIcon size={14} />
          </span>
        </Link>
      </div>

      <style jsx>{`
        .cluster-card {
          background: var(--card-bg, white);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .cluster-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-color: var(--primary-color, #007bff);
        }

        .cluster-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .cluster-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary, #333);
          margin: 0;
          flex: 1;
          line-height: 1.4;
        }

        .cluster-badges {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          margin-left: 16px;
        }

        .cluster-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--badge-bg, #f8f9fa);
          border: 1px solid var(--badge-border, #e9ecef);
          border-radius: 12px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary, #6c757d);
        }

        .cluster-summary {
          margin-bottom: 16px;
        }

        .cluster-summary p {
          color: var(--text-secondary, #666);
          line-height: 1.5;
          margin: 0;
        }

        .entity-section {
          margin-bottom: 16px;
        }

        .entity-group {
          margin-bottom: 8px;
        }

        .entity-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-tertiary, #999);
          margin-right: 8px;
        }

        .entity-chips {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .entity-chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
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

        .entity-more {
          background: #f5f5f5;
          color: #757575;
        }

        .cluster-sources {
          margin-bottom: 16px;
        }

        .sources-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-tertiary, #999);
          margin-right: 8px;
        }

        .sources-list {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .source-name {
          font-size: 0.8rem;
          color: var(--text-secondary, #666);
        }

        .source-count {
          color: var(--text-tertiary, #999);
          font-weight: 500;
        }

        .source-more {
          font-size: 0.8rem;
          color: var(--text-tertiary, #999);
          font-style: italic;
        }

        .cluster-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border-light, #f0f0f0);
        }

        .cluster-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          color: var(--text-tertiary, #999);
        }

        .cluster-readmore {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--primary-color, #007bff);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .cluster-readmore:hover {
          color: var(--primary-hover, #0056b3);
        }

        @media (max-width: 768px) {
          .cluster-header {
            flex-direction: column;
            gap: 8px;
          }

          .cluster-badges {
            margin-left: 0;
          }

          .cluster-footer {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}