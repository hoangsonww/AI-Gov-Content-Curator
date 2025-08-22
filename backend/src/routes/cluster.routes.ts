import { Router } from "express";
import {
  getClusters,
  getClusterById,
  getArticleCluster,
  ingestArticle,
  rebuildClustersAdmin,
  mergeClusters,
  splitCluster,
} from "../controllers/cluster.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Clusters
 *     description: API endpoints for managing article clusters
 */

/**
 * @swagger
 * /api/clusters:
 *   get:
 *     tags: [Clusters]
 *     summary: Retrieve a list of article clusters
 *     description: Get paginated clusters with optional date filtering.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of clusters per page.
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter clusters updated since this date.
 *     responses:
 *       200:
 *         description: A list of clusters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cluster'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       500:
 *         description: Failed to fetch clusters.
 */
router.get("/", getClusters);

/**
 * @swagger
 * /api/clusters/{id}:
 *   get:
 *     tags: [Clusters]
 *     summary: Retrieve a cluster by ID with timeline
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The cluster ID.
 *     responses:
 *       200:
 *         description: Cluster details with timeline.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cluster:
 *                   $ref: '#/components/schemas/Cluster'
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClusterEvent'
 *                 timeline:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ClusterEvent'
 *       404:
 *         description: Cluster not found.
 *       500:
 *         description: Failed to fetch cluster.
 */
router.get("/:id", getClusterById);

/**
 * @swagger
 * /api/articles/{id}/cluster:
 *   get:
 *     tags: [Clusters]
 *     summary: Get the cluster for a specific article
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The article ID.
 *     responses:
 *       200:
 *         description: Article's cluster information.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cluster:
 *                   $ref: '#/components/schemas/Cluster'
 *       404:
 *         description: Article not found.
 *       500:
 *         description: Failed to fetch article cluster.
 */
router.get("/articles/:id/cluster", getArticleCluster);

/**
 * @swagger
 * /api/internal/cluster/ingest:
 *   post:
 *     tags: [Clusters]
 *     summary: Assign an article to a cluster (internal use)
 *     description: Internal endpoint used by crawler to assign articles to clusters.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *                 description: ID of the article to assign to a cluster.
 *     responses:
 *       200:
 *         description: Article successfully assigned to cluster.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 clusterId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request parameters.
 *       500:
 *         description: Failed to assign article to cluster.
 */
router.post("/internal/cluster/ingest", ingestArticle);

/**
 * @swagger
 * /api/admin/clusters/rebuild:
 *   post:
 *     tags: [Clusters]
 *     summary: Rebuild clusters within a time window (admin only)
 *     description: Administrative endpoint to rebuild cluster assignments.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               windowDays:
 *                 type: integer
 *                 default: 14
 *                 description: Number of days to rebuild clusters for.
 *     responses:
 *       200:
 *         description: Clusters successfully rebuilt.
 *       500:
 *         description: Failed to rebuild clusters.
 */
router.post("/admin/clusters/rebuild", rebuildClustersAdmin);

/**
 * @swagger
 * /api/admin/clusters/merge:
 *   post:
 *     tags: [Clusters]
 *     summary: Merge two clusters (admin only)
 *     description: Administrative endpoint to merge two clusters.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sourceId:
 *                 type: string
 *                 description: ID of the cluster to merge from.
 *               targetId:
 *                 type: string
 *                 description: ID of the cluster to merge into.
 *     responses:
 *       200:
 *         description: Clusters successfully merged.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: One or both clusters not found.
 *       500:
 *         description: Failed to merge clusters.
 */
router.post("/admin/clusters/merge", mergeClusters);

/**
 * @swagger
 * /api/admin/clusters/split:
 *   post:
 *     tags: [Clusters]
 *     summary: Split articles from a cluster (admin only)
 *     description: Administrative endpoint to split articles into a new cluster.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clusterId:
 *                 type: string
 *                 description: ID of the cluster to split from.
 *               articleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of article IDs to move to new cluster.
 *     responses:
 *       200:
 *         description: Cluster successfully split.
 *       400:
 *         description: Invalid request parameters.
 *       404:
 *         description: Cluster not found.
 *       500:
 *         description: Failed to split cluster.
 */
router.post("/admin/clusters/split", splitCluster);

export default router;