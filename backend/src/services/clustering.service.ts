import Article, { IArticle } from '../models/article.model';
import Cluster, { ICluster } from '../models/cluster.model';
import ClusterEvent from '../models/clusterEvent.model';
import { MinHash, LSHIndex, TFIDFVector } from './similarity.service';
import { normalizeText, extractLead } from '../utils/textNormalization';
import logger from '../utils/logger';

/**
 * Configuration for clustering thresholds
 */
const CLUSTERING_CONFIG = {
  MINHASH_THRESHOLD: 0.8,      // High threshold for near-duplicates
  TFIDF_THRESHOLD: 0.6,        // Medium threshold for similar articles
  MIN_TITLE_LENGTH: 10,        // Minimum title length to consider
  MAX_CLUSTER_AGE_DAYS: 14,    // Rolling window for clustering
  MAX_CANDIDATES: 50,          // Max candidates to check in detail
};

/**
 * In-memory LSH index for fast similarity search
 * In production, this would be stored in Redis or similar
 */
let lshIndex: LSHIndex | null = null;
let documentFreqs: Map<string, number> = new Map();
let totalDocs = 0;

/**
 * Initialize or get the LSH index
 */
async function getLSHIndex(): Promise<LSHIndex> {
  if (!lshIndex) {
    lshIndex = new LSHIndex(128, 16);
    // TODO: Load existing signatures from database
    await loadExistingSignatures();
  }
  return lshIndex;
}

/**
 * Load existing article signatures into the LSH index
 */
async function loadExistingSignatures(): Promise<void> {
  try {
    const articles = await Article.find(
      { 'signatures.minhash': { $exists: true } },
      { _id: 1, 'signatures.minhash': 1 }
    ).lean();

    for (const article of articles) {
      if (article.signatures?.minhash) {
        const minhash = MinHash.fromSignature(article.signatures.minhash);
        lshIndex!.add(article._id.toString(), minhash);
      }
    }

    // Load document frequencies for TF-IDF
    totalDocs = await Article.countDocuments();
    // TODO: Calculate document frequencies - for now use dummy values
    
    logger.info(`Loaded ${articles.length} article signatures into LSH index`);
  } catch (error) {
    logger.error('Error loading existing signatures:', error);
  }
}

/**
 * Generate similarity signatures for an article
 */
export async function generateSignatures(article: IArticle): Promise<{
  minhash: string;
  tfidf: string;
  normalizedTitle: string;
  normalizedLead: string;
}> {
  const title = normalizeText(article.title);
  const lead = extractLead(article.content, 300);
  const normalizedLead = normalizeText(lead);
  const combinedText = `${title} ${normalizedLead}`;

  // Generate MinHash signature
  const minhash = MinHash.fromText(combinedText, 5, 128);
  
  // Generate TF-IDF signature (simplified for now)
  const tfidf = TFIDFVector.fromText(combinedText, documentFreqs, Math.max(totalDocs, 1));

  return {
    minhash: minhash.getSignature(),
    tfidf: tfidf.getSignature(),
    normalizedTitle: title,
    normalizedLead: normalizedLead
  };
}

/**
 * Find similar articles using LSH and similarity thresholds
 */
async function findSimilarArticles(articleId: string, signatures: any): Promise<{
  candidates: string[];
  similarities: Map<string, number>;
}> {
  const index = await getLSHIndex();
  const articleMinhash = MinHash.fromSignature(signatures.minhash);
  
  // Get candidates from LSH
  const candidates = Array.from(index.getCandidates(articleMinhash))
    .filter(id => id !== articleId)
    .slice(0, CLUSTERING_CONFIG.MAX_CANDIDATES);

  const similarities = new Map<string, number>();

  // Calculate detailed similarities for candidates
  for (const candidateId of candidates) {
    try {
      const candidate = await Article.findById(candidateId, {
        'signatures.minhash': 1,
        'signatures.tfidf': 1,
        clusterId: 1
      }).lean();

      if (!candidate?.signatures?.minhash) continue;

      // Calculate MinHash similarity
      const candidateMinhash = MinHash.fromSignature(candidate.signatures.minhash);
      const minhashSim = articleMinhash.similarity(candidateMinhash);

      if (minhashSim >= CLUSTERING_CONFIG.MINHASH_THRESHOLD) {
        similarities.set(candidateId, minhashSim);
      } else if (minhashSim >= 0.4 && candidate.signatures.tfidf && signatures.tfidf) {
        // Use TF-IDF for borderline cases
        const articleTfidf = TFIDFVector.fromSignature(signatures.tfidf);
        const candidateTfidf = TFIDFVector.fromSignature(candidate.signatures.tfidf);
        const tfidfSim = articleTfidf.cosineSimilarity(candidateTfidf);
        
        if (tfidfSim >= CLUSTERING_CONFIG.TFIDF_THRESHOLD) {
          similarities.set(candidateId, tfidfSim);
        }
      }
    } catch (error) {
      logger.error(`Error calculating similarity for candidate ${candidateId}:`, error);
    }
  }

  return { candidates, similarities };
}

/**
 * Find the best cluster for an article or create a new one
 */
export async function assignToCluster(articleId: string): Promise<string | null> {
  try {
    const article = await Article.findById(articleId);
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    // Skip if already clustered
    if (article.clusterId) {
      return article.clusterId.toString();
    }

    // Generate signatures if not present
    let signatures = article.signatures;
    if (!signatures?.minhash) {
      const generatedSigs = await generateSignatures(article);
      signatures = generatedSigs;
      await Article.findByIdAndUpdate(articleId, {
        $set: {
          signatures: {
            minhash: generatedSigs.minhash,
            tfidf: generatedSigs.tfidf
          },
          normalizedTitle: generatedSigs.normalizedTitle,
          normalizedLead: generatedSigs.normalizedLead
        }
      });
    }

    // Find similar articles
    const { similarities } = await findSimilarArticles(articleId, signatures);

    if (similarities.size === 0) {
      // No similar articles found, create new cluster
      return await createNewCluster(article);
    }

    // Find the best cluster among similar articles
    const clusterCandidates = new Map<string, { score: number; count: number }>();
    
    for (const [similarArticleId, similarity] of similarities) {
      const similarArticle = await Article.findById(similarArticleId, { clusterId: 1 }).lean();
      if (similarArticle?.clusterId) {
        const clusterId = similarArticle.clusterId.toString();
        const current = clusterCandidates.get(clusterId) || { score: 0, count: 0 };
        clusterCandidates.set(clusterId, {
          score: Math.max(current.score, similarity),
          count: current.count + 1
        });
      }
    }

    if (clusterCandidates.size === 0) {
      // Similar articles exist but no clusters, create new cluster
      return await createNewCluster(article);
    }

    // Select best cluster (highest score with tie-breaking by count)
    let bestClusterId = '';
    let bestScore = 0;
    let bestCount = 0;

    for (const [clusterId, { score, count }] of clusterCandidates) {
      if (score > bestScore || (score === bestScore && count > bestCount)) {
        bestClusterId = clusterId;
        bestScore = score;
        bestCount = count;
      }
    }

    // Add article to the best cluster
    await addToCluster(bestClusterId, article);
    
    // Add to LSH index
    const index = await getLSHIndex();
    const minhash = MinHash.fromSignature(signatures.minhash || '');
    index.add(articleId, minhash);

    return bestClusterId;

  } catch (error) {
    logger.error(`Error assigning article ${articleId} to cluster:`, error);
    return null;
  }
}

/**
 * Create a new cluster for an article
 */
async function createNewCluster(article: IArticle): Promise<string> {
  const cluster = new Cluster({
    canonicalTitle: article.title,
    summary: article.summary || article.title,
    entityBag: {
      persons: article.entities?.persons || [],
      orgs: article.entities?.orgs || [],
      places: article.entities?.places || [],
      topics: article.entities?.topics || article.topics || []
    },
    articleIds: [article._id],
    sourceCounts: new Map([[article.source, 1]]),
    firstSeen: article.fetchedAt,
    lastUpdated: new Date(),
    quality: {
      coherence: 1.0,
      size: 1
    }
  });

  await cluster.save();

  // Update article with cluster ID
  await Article.findByIdAndUpdate(article._id, {
    $set: { clusterId: cluster._id }
  });

  // Create cluster event
  await new ClusterEvent({
    clusterId: cluster._id,
    articleId: article._id,
    ts: article.fetchedAt,
    kind: 'first_report'
  }).save();

  logger.info(`Created new cluster ${cluster._id} for article ${article._id}`);
  return cluster._id.toString();
}

/**
 * Add an article to an existing cluster
 */
async function addToCluster(clusterId: string, article: IArticle): Promise<void> {
  const cluster = await Cluster.findById(clusterId);
  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  // Update cluster
  const sourceCounts = cluster.sourceCounts instanceof Map 
    ? cluster.sourceCounts 
    : new Map(Object.entries(cluster.sourceCounts || {}));
  
  sourceCounts.set(article.source, (sourceCounts.get(article.source) || 0) + 1);

  // Merge entities
  const entityBag = cluster.entityBag;
  if (article.entities) {
    entityBag.persons = [...new Set([...entityBag.persons, ...article.entities.persons])];
    entityBag.orgs = [...new Set([...entityBag.orgs, ...article.entities.orgs])];
    entityBag.places = [...new Set([...entityBag.places, ...article.entities.places])];
    entityBag.topics = [...new Set([...entityBag.topics, ...article.entities.topics])];
  }

  await Cluster.findByIdAndUpdate(clusterId, {
    $push: { articleIds: article._id },
    $set: {
      sourceCounts,
      entityBag,
      lastUpdated: new Date(),
      'quality.size': cluster.articleIds.length + 1
    }
  });

  // Update article with cluster ID
  await Article.findByIdAndUpdate(article._id, {
    $set: { clusterId }
  });

  // Create cluster event
  await new ClusterEvent({
    clusterId,
    articleId: article._id,
    ts: article.fetchedAt,
    kind: cluster.articleIds.length === 0 ? 'first_report' : 'update'
  }).save();

  logger.info(`Added article ${article._id} to cluster ${clusterId}`);
}

/**
 * Rebuild clusters for articles within a time window
 */
export async function rebuildClusters(windowDays: number = 14): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  logger.info(`Rebuilding clusters for articles since ${cutoffDate}`);

  // Clear existing cluster assignments for articles in window
  await Article.updateMany(
    { fetchedAt: { $gte: cutoffDate } },
    { $unset: { clusterId: 1 } }
  );

  // Delete clusters that are now empty
  await Cluster.deleteMany({
    articleIds: { $size: 0 }
  });

  // Reset LSH index
  lshIndex = null;

  // Reassign articles to clusters
  const articles = await Article.find(
    { fetchedAt: { $gte: cutoffDate }, clusterId: { $exists: false } },
    { _id: 1 }
  ).sort({ fetchedAt: 1 });

  for (const article of articles) {
    await assignToCluster(article._id.toString());
  }

  logger.info(`Completed rebuilding clusters for ${articles.length} articles`);
}