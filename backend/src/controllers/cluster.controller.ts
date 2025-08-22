import { Request, Response } from "express";
import Cluster from "../models/cluster.model";
import Article from "../models/article.model";
import ClusterEvent from "../models/clusterEvent.model";
import { assignToCluster, rebuildClusters } from "../services/clustering.service";
import logger from "../utils/logger";

/**
 * Get paginated list of clusters
 * @route GET /api/clusters
 */
export const getClusters = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, since } = req.query;
    const filter: any = {};

    // Filter by date if provided
    if (since) {
      filter.lastUpdated = { $gte: new Date(since as string) };
    }

    const clusters = await Cluster.find(filter)
      .sort({ lastUpdated: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('articleIds', 'title url source fetchedAt');

    const total = await Cluster.countDocuments(filter);
    
    res.json({ 
      data: clusters, 
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    logger.error("Error fetching clusters:", error);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
};

/**
 * Get cluster by ID with timeline
 * @route GET /api/clusters/:id
 */
export const getClusterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cluster = await Cluster.findById(id)
      .populate('articleIds', 'title url source fetchedAt summary');

    if (!cluster) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    // Get cluster events for timeline
    const events = await ClusterEvent.find({ clusterId: id })
      .sort({ ts: -1 })
      .populate('articleId', 'title url source fetchedAt');

    res.json({ 
      cluster,
      events,
      timeline: events // Alias for frontend compatibility
    });
  } catch (error) {
    logger.error(`Error fetching cluster ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch cluster" });
  }
};

/**
 * Get cluster for a specific article
 * @route GET /api/articles/:id/cluster
 */
export const getArticleCluster = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const article = await Article.findById(id, 'clusterId title');
    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    if (!article.clusterId) {
      return res.json({ cluster: null });
    }

    const cluster = await Cluster.findById(article.clusterId)
      .populate('articleIds', 'title url source fetchedAt');

    res.json({ cluster });
  } catch (error) {
    logger.error(`Error fetching cluster for article ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch article cluster" });
  }
};

/**
 * Internal endpoint to assign article to cluster (used by crawler)
 * @route POST /api/internal/cluster/ingest
 */
export const ingestArticle = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.body;

    if (!articleId) {
      return res.status(400).json({ error: "Article ID is required" });
    }

    const clusterId = await assignToCluster(articleId);
    
    res.json({ 
      success: true,
      clusterId,
      message: `Article ${articleId} assigned to cluster ${clusterId || 'new'}`
    });
  } catch (error) {
    logger.error(`Error ingesting article ${req.body?.articleId}:`, error);
    res.status(500).json({ error: "Failed to assign article to cluster" });
  }
};

/**
 * Admin: Rebuild clusters within a time window
 * @route POST /api/admin/clusters/rebuild
 */
export const rebuildClustersAdmin = async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication/authorization check for admin role
    const { windowDays = 14 } = req.body;

    await rebuildClusters(windowDays);
    
    res.json({ 
      success: true,
      message: `Clusters rebuilt for last ${windowDays} days`
    });
  } catch (error) {
    logger.error("Error rebuilding clusters:", error);
    res.status(500).json({ error: "Failed to rebuild clusters" });
  }
};

/**
 * Admin: Merge two clusters
 * @route POST /api/admin/clusters/merge
 */
export const mergeClusters = async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication/authorization check for admin role
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
      return res.status(400).json({ error: "Source and target cluster IDs are required" });
    }

    const sourceCluster = await Cluster.findById(sourceId);
    const targetCluster = await Cluster.findById(targetId);

    if (!sourceCluster || !targetCluster) {
      return res.status(404).json({ error: "One or both clusters not found" });
    }

    // Merge articles
    await Article.updateMany(
      { clusterId: sourceId },
      { clusterId: targetId }
    );

    // Update target cluster
    const mergedEntityBag = {
      persons: [...new Set([...targetCluster.entityBag.persons, ...sourceCluster.entityBag.persons])],
      orgs: [...new Set([...targetCluster.entityBag.orgs, ...sourceCluster.entityBag.orgs])],
      places: [...new Set([...targetCluster.entityBag.places, ...sourceCluster.entityBag.places])],
      topics: [...new Set([...targetCluster.entityBag.topics, ...sourceCluster.entityBag.topics])]
    };

    const mergedSourceCounts = new Map([
      ...Object.entries(targetCluster.sourceCounts instanceof Map ? 
        Object.fromEntries(targetCluster.sourceCounts) : targetCluster.sourceCounts),
      ...Object.entries(sourceCluster.sourceCounts instanceof Map ? 
        Object.fromEntries(sourceCluster.sourceCounts) : sourceCluster.sourceCounts)
    ]);

    await Cluster.findByIdAndUpdate(targetId, {
      $push: { articleIds: { $each: sourceCluster.articleIds } },
      $set: {
        entityBag: mergedEntityBag,
        sourceCounts: mergedSourceCounts,
        lastUpdated: new Date(),
        'quality.size': targetCluster.articleIds.length + sourceCluster.articleIds.length
      }
    });

    // Update cluster events
    await ClusterEvent.updateMany(
      { clusterId: sourceId },
      { clusterId: targetId }
    );

    // Delete source cluster
    await Cluster.findByIdAndDelete(sourceId);

    res.json({ 
      success: true,
      message: `Merged cluster ${sourceId} into ${targetId}`
    });
  } catch (error) {
    logger.error("Error merging clusters:", error);
    res.status(500).json({ error: "Failed to merge clusters" });
  }
};

/**
 * Admin: Split articles from a cluster into a new cluster
 * @route POST /api/admin/clusters/split
 */
export const splitCluster = async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication/authorization check for admin role
    const { clusterId, articleIds } = req.body;

    if (!clusterId || !articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({ error: "Cluster ID and article IDs array are required" });
    }

    const cluster = await Cluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    // Get articles to split
    const articlesToSplit = await Article.find({ 
      _id: { $in: articleIds },
      clusterId: clusterId
    });

    if (articlesToSplit.length === 0) {
      return res.status(400).json({ error: "No valid articles found in cluster" });
    }

    // Create new cluster with first article
    const firstArticle = articlesToSplit[0];
    const newCluster = new Cluster({
      canonicalTitle: firstArticle.title,
      summary: firstArticle.summary || firstArticle.title,
      entityBag: {
        persons: firstArticle.entities?.persons || [],
        orgs: firstArticle.entities?.orgs || [],
        places: firstArticle.entities?.places || [],
        topics: firstArticle.entities?.topics || firstArticle.topics || []
      },
      articleIds: articleIds,
      sourceCounts: new Map(),
      firstSeen: firstArticle.fetchedAt,
      lastUpdated: new Date(),
      quality: {
        coherence: 1.0,
        size: articlesToSplit.length
      }
    });

    // Calculate source counts for new cluster
    const sourceCounts = new Map<string, number>();
    for (const article of articlesToSplit) {
      sourceCounts.set(article.source, (sourceCounts.get(article.source) || 0) + 1);
    }
    newCluster.sourceCounts = Object.fromEntries(sourceCounts);

    await newCluster.save();

    // Update articles to point to new cluster
    await Article.updateMany(
      { _id: { $in: articleIds } },
      { clusterId: newCluster._id }
    );

    // Remove articles from original cluster
    await Cluster.findByIdAndUpdate(clusterId, {
      $pull: { articleIds: { $in: articleIds } },
      $set: { 
        lastUpdated: new Date(),
        'quality.size': cluster.articleIds.length - articleIds.length
      }
    });

    // Move cluster events
    await ClusterEvent.updateMany(
      { clusterId: clusterId, articleId: { $in: articleIds } },
      { clusterId: newCluster._id }
    );

    res.json({ 
      success: true,
      newClusterId: newCluster._id,
      message: `Split ${articleIds.length} articles into new cluster ${newCluster._id}`
    });
  } catch (error) {
    logger.error("Error splitting cluster:", error);
    res.status(500).json({ error: "Failed to split cluster" });
  }
};