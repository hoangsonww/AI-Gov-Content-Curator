import Cluster, { ICluster } from '../models/cluster.model';
import logger from '../utils/logger';

/**
 * Configuration for cluster ranking
 */
const RANKING_CONFIG = {
  MIN_CLUSTER_SIZE: 2,           // Minimum articles in cluster to be considered
  RECENCY_WEIGHT: 0.4,           // Weight for recency in ranking
  SIZE_WEIGHT: 0.3,              // Weight for cluster size
  DIVERSITY_WEIGHT: 0.2,         // Weight for source diversity
  COHERENCE_WEIGHT: 0.1,         // Weight for cluster quality
  MAX_AGE_HOURS: 72,             // Max age for clusters to be included (3 days)
};

/**
 * Score a cluster for newsletter ranking
 */
function scoreCluster(cluster: ICluster): number {
  const now = new Date();
  const ageHours = (now.getTime() - new Date(cluster.lastUpdated).getTime()) / (1000 * 60 * 60);
  
  // Skip clusters that are too old
  if (ageHours > RANKING_CONFIG.MAX_AGE_HOURS) {
    return 0;
  }

  // Skip clusters that are too small
  if (cluster.quality.size < RANKING_CONFIG.MIN_CLUSTER_SIZE) {
    return 0;
  }

  // Recency score (newer is better, exponential decay)
  const recencyScore = Math.exp(-ageHours / 24); // Decay over 24 hours

  // Size score (more articles is better, with diminishing returns)
  const normalizedSize = Math.min(cluster.quality.size / 10, 1); // Cap at 10 articles
  const sizeScore = Math.sqrt(normalizedSize);

  // Source diversity score (more sources is better)
  const sourceCounts = cluster.sourceCounts instanceof Map 
    ? Object.fromEntries(cluster.sourceCounts) 
    : cluster.sourceCounts || {};
  const sourceCount = Object.keys(sourceCounts).length;
  const diversityScore = Math.min(sourceCount / 5, 1); // Cap at 5 sources

  // Coherence score (cluster quality)
  const coherenceScore = cluster.quality.coherence || 0.5;

  // Weighted final score
  const finalScore = 
    recencyScore * RANKING_CONFIG.RECENCY_WEIGHT +
    sizeScore * RANKING_CONFIG.SIZE_WEIGHT +
    diversityScore * RANKING_CONFIG.DIVERSITY_WEIGHT +
    coherenceScore * RANKING_CONFIG.COHERENCE_WEIGHT;

  return finalScore;
}

/**
 * Get top clusters for newsletter
 */
export async function getTopClustersForNewsletter(
  limit: number = 10,
  sinceDate?: Date
): Promise<ICluster[]> {
  try {
    const filter: any = {
      'quality.size': { $gte: RANKING_CONFIG.MIN_CLUSTER_SIZE }
    };

    // Filter by date if provided
    if (sinceDate) {
      filter.lastUpdated = { $gte: sinceDate };
    } else {
      // Default to last 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setHours(threeDaysAgo.getHours() - RANKING_CONFIG.MAX_AGE_HOURS);
      filter.lastUpdated = { $gte: threeDaysAgo };
    }

    // Get clusters and populate article information
    const clusters = await Cluster.find(filter)
      .populate('articleIds', 'title url source fetchedAt')
      .lean() as ICluster[];

    if (!clusters.length) {
      logger.info('No clusters found for newsletter');
      return [];
    }

    // Score and rank clusters
    const scoredClusters = clusters
      .map(cluster => ({
        cluster,
        score: scoreCluster(cluster)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.cluster);

    logger.info(`Ranked ${scoredClusters.length} clusters for newsletter`);
    return scoredClusters;

  } catch (error) {
    logger.error('Error getting top clusters for newsletter:', error);
    return [];
  }
}

/**
 * Get cluster statistics for newsletter
 */
export async function getClusterStats(cluster: ICluster): Promise<{
  totalArticles: number;
  sourceCount: number;
  topSources: string[];
  timeSpan: string;
}> {
  const sourceCounts = cluster.sourceCounts instanceof Map 
    ? Object.fromEntries(cluster.sourceCounts) 
    : cluster.sourceCounts || {};

  const sourceEntries = Object.entries(sourceCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number));

  const totalArticles = cluster.quality.size || cluster.articleIds?.length || 0;
  const sourceCount = sourceEntries.length;
  const topSources = sourceEntries.slice(0, 3).map(([source]) => source);

  // Calculate time span
  const firstSeen = new Date(cluster.firstSeen);
  const lastUpdated = new Date(cluster.lastUpdated);
  const hoursDiff = (lastUpdated.getTime() - firstSeen.getTime()) / (1000 * 60 * 60);
  
  let timeSpan: string;
  if (hoursDiff < 2) {
    timeSpan = 'Breaking';
  } else if (hoursDiff < 24) {
    timeSpan = 'Today';
  } else if (hoursDiff < 48) {
    timeSpan = 'Yesterday';
  } else {
    const daysDiff = Math.floor(hoursDiff / 24);
    timeSpan = `${daysDiff} days`;
  }

  return {
    totalArticles,
    sourceCount,
    topSources,
    timeSpan
  };
}

/**
 * Format cluster title for newsletter
 */
export function formatClusterTitle(cluster: ICluster): string {
  let title = cluster.canonicalTitle;
  
  // Truncate if too long
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }

  return title;
}

/**
 * Format cluster summary for newsletter
 */
export function formatClusterSummary(cluster: ICluster): string {
  let summary = cluster.summary;
  
  // Truncate if too long
  if (summary.length > 300) {
    summary = summary.substring(0, 297) + '...';
  }

  return summary;
}