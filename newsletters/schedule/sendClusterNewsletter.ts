import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import NewsletterSubscriber from "../models/newsletterSubscriber.model";
import Article from "../models/article.model";
import Cluster from "../models/cluster.model";
import type { Resend as ResendClient } from "resend";
import { marked } from "marked";

/**
 * Configuration for cluster newsletter
 */
const NEWSLETTER_CONFIG = {
  MAX_CLUSTERS: 8,               // Max clusters to include
  MAX_INDIVIDUAL_ARTICLES: 10,   // Max individual articles as fallback
  MIN_CLUSTER_SIZE: 2,           // Minimum articles in cluster
  RECENCY_WEIGHT: 0.4,           // Weight for recency in ranking
  SIZE_WEIGHT: 0.3,              // Weight for cluster size
  DIVERSITY_WEIGHT: 0.2,         // Weight for source diversity
  COHERENCE_WEIGHT: 0.1,         // Weight for cluster quality
  MAX_AGE_HOURS: 72,             // Max age for content (3 days)
};

/**
 * Score a cluster for newsletter ranking
 */
function scoreCluster(cluster: any): number {
  const now = new Date();
  const ageHours = (now.getTime() - new Date(cluster.lastUpdated).getTime()) / (1000 * 60 * 60);
  
  // Skip clusters that are too old
  if (ageHours > NEWSLETTER_CONFIG.MAX_AGE_HOURS) {
    return 0;
  }

  // Skip clusters that are too small
  if (cluster.quality.size < NEWSLETTER_CONFIG.MIN_CLUSTER_SIZE) {
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
  const coherenceScore = cluster.quality?.coherence || 0.5;

  // Weighted final score
  const finalScore = 
    recencyScore * NEWSLETTER_CONFIG.RECENCY_WEIGHT +
    sizeScore * NEWSLETTER_CONFIG.SIZE_WEIGHT +
    diversityScore * NEWSLETTER_CONFIG.DIVERSITY_WEIGHT +
    coherenceScore * NEWSLETTER_CONFIG.COHERENCE_WEIGHT;

  return finalScore;
}

/**
 * Get top clusters for newsletter
 */
async function getTopClusters(sinceDate: Date): Promise<any[]> {
  try {
    const filter = {
      lastUpdated: { $gte: sinceDate },
      'quality.size': { $gte: NEWSLETTER_CONFIG.MIN_CLUSTER_SIZE }
    };

    const clusters = await Cluster.find(filter)
      .populate('articleIds', 'title url source fetchedAt')
      .lean();

    if (!clusters.length) {
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
      .slice(0, NEWSLETTER_CONFIG.MAX_CLUSTERS)
      .map(item => item.cluster);

    return scoredClusters;

  } catch (error) {
    console.error('Error getting top clusters:', error);
    return [];
  }
}

/**
 * Format cluster for newsletter display
 */
function formatClusterForNewsletter(cluster: any, index: number): string {
  const sourceCounts = cluster.sourceCounts instanceof Map 
    ? Object.fromEntries(cluster.sourceCounts) 
    : cluster.sourceCounts || {};

  const sourceEntries = Object.entries(sourceCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number));

  const totalArticles = cluster.quality?.size || cluster.articleIds?.length || 0;
  const topSources = sourceEntries.slice(0, 3).map(([source]) => source);

  // Truncate title if too long
  let title = cluster.canonicalTitle;
  if (title.length > 120) {
    title = title.substring(0, 117) + '...';
  }

  // Truncate summary if too long
  let summary = cluster.summary;
  if (summary.length > 350) {
    summary = summary.substring(0, 347) + '...';
  }

  // Convert summary markdown to HTML
  const summaryHtml = summary 
    ? `<div style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#555;">${marked(summary)}</div>`
    : "";

  // Format sources
  const sourcesText = topSources.length > 0 
    ? `Sources: ${topSources.join(', ')}${sourceEntries.length > 3 ? ` +${sourceEntries.length - 3} more` : ''}`
    : '';

  // Get cluster URL - assuming frontend is at https://synthoraai.vercel.app
  const clusterUrl = `https://synthoraai.vercel.app/clusters/${cluster._id}`;

  return `<tr>
    <td style="padding:16px 24px;border-bottom:1px solid #eee;">
      <div style="display:flex;align-items:center;margin-bottom:6px;">
        <a href="${clusterUrl}" style="font-size:16px;font-weight:600;color:#0d6efd;text-decoration:none;flex:1;">
          ${index + 1}. ${title}
        </a>
        <span style="background:#e3f2fd;color:#1976d2;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;margin-left:8px;">
          ${totalArticles} articles
        </span>
      </div>
      ${summaryHtml}
      <div style="margin:8px 0 0;font-size:12px;color:#999;">
        <div style="margin-bottom:2px;">${sourcesText}</div>
        <div>Updated ${formatDate(cluster.lastUpdated)} · <a href="${clusterUrl}" style="color:#0d6efd;text-decoration:none;">View Timeline</a></div>
      </div>
    </td>
  </tr>`;
}

/**
 * Format individual article for newsletter (fallback)
 */
function formatArticleForNewsletter(article: any, index: number): string {
  const summaryHtml = article.summary
    ? `<div style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#555;">${marked(article.summary)}</div>`
    : "";

  return `<tr>
    <td style="padding:16px 24px;border-bottom:1px solid #eee;">
      <a href="${article.url}" style="font-size:16px;font-weight:600;color:#0d6efd;text-decoration:none;">
        ${index + 1}. ${article.title}
      </a>
      ${summaryHtml}
      <p style="margin:6px 0 0;font-size:12px;color:#999;">
        ${formatDate(article.fetchedAt)} · ${article.source ?? ""}
        <span style="color:#dc3545;font-weight:500;margin-left:8px;">(early)</span>
      </p>
    </td>
  </tr>`;
}

/**
 * Format date for display
 */
function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Send cluster-enhanced newsletter to all subscribers
 */
export async function sendClusterNewsletter() {
  const {
    MONGODB_URI,
    RESEND_API_KEY,
    RESEND_FROM = "AI Curator <news@sonnguyenhoang.com>",
    UNSUBSCRIBE_BASE_URL,
  } = process.env;

  if (!MONGODB_URI) throw new Error("MONGODB_URI not set");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");

  const { Resend } = (await import("resend")) as typeof import("resend");
  const resend: ResendClient = new Resend(RESEND_API_KEY);

  await mongoose.connect(MONGODB_URI);

  const subscribers = await NewsletterSubscriber.find({});
  console.log(`Sending cluster newsletter to ${subscribers.length} subscriber(s)`);

  // Rate limit: max 2 requests per second → delay 500ms between each send
  const RATE_LIMIT_DELAY_MS = 500;
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (const sub of subscribers) {
    const since = sub.lastSentAt ?? new Date(0);
    
    // Try to get clusters first
    const clusters = await getTopClusters(since);
    
    let contentRows = '';
    let contentDescription = '';
    let hasContent = false;

    if (clusters.length > 0) {
      // Use cluster-based content
      contentRows = clusters
        .map((cluster, index) => formatClusterForNewsletter(cluster, index))
        .join('');
      contentDescription = `${clusters.length} top story cluster${clusters.length > 1 ? 's' : ''}`;
      hasContent = true;
    } else {
      // Fallback to individual articles
      const articles = await Article.find({ fetchedAt: { $gt: since } })
        .sort({ fetchedAt: 1 })
        .limit(NEWSLETTER_CONFIG.MAX_INDIVIDUAL_ARTICLES + 1)
        .lean();

      if (articles.length > 0) {
        const shown = articles.slice(0, NEWSLETTER_CONFIG.MAX_INDIVIDUAL_ARTICLES);
        contentRows = shown
          .map((article, index) => formatArticleForNewsletter(article, index))
          .join('');
        contentDescription = `${shown.length} new article${shown.length > 1 ? 's' : ''}`;
        
        // Add note about individual articles
        if (articles.length > NEWSLETTER_CONFIG.MAX_INDIVIDUAL_ARTICLES) {
          contentRows += `<tr><td style="padding:16px 24px;font-size:14px;color:#555;text-align:center;">
            …and more! Visit <a href="https://synthoraai.vercel.app" style="color:#0d6efd;text-decoration:none;">our site</a> to see all articles.
          </td></tr>`;
        }
        hasContent = true;
      }
    }

    if (!hasContent) {
      console.log(`${sub.email}: up-to-date`);
      continue;
    }

    // Build HTML email
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI Article Curator Newsletter</title></head>
      <body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellspacing="0" cellpadding="0" style="padding:20px 0;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:8px;overflow:hidden;">
          <tr style="background:#0d6efd;color:#fff;"><td style="padding:24px;text-align:center;font-size:22px;font-weight:700;">
            <a href="https://synthoraai.vercel.app" style="color:#fff;text-decoration:none;">
              AI Article Curator Newsletter
            </a>
          </td></tr>
          <tr><td style="padding:20px 24px;font-size:15px;color:#333;">
            Hi there 👋 – here are ${contentDescription} since your last digest:
            ${clusters.length > 0 ? 
              '<div style="margin:8px 0 0;font-size:13px;color:#666;"><strong>New:</strong> Stories are now grouped by topic with multiple sources and timelines!</div>' 
              : ''
            }
          </td></tr>
          ${contentRows}
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            For the full experience with timelines and source grouping, visit 
            <a href="https://synthoraai.vercel.app/clusters" style="color:#0d6efd;text-decoration:none;">our clusters page</a>.<br>
          </td></tr>
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            You're receiving this because you subscribed on our site.<br>
            ${
              UNSUBSCRIBE_BASE_URL
                ? `<a href="${UNSUBSCRIBE_BASE_URL}?email=${encodeURIComponent(
                    sub.email,
                  )}" style="color:#0d6efd;text-decoration:none;">Unsubscribe</a>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:20px 24px;text-align:center;font-size:12px;color:#999;">
            Visit our site: <a href="https://synthoraai.vercel.app" style="color:#0d6efd;text-decoration:none;">synthoraai.vercel.app</a>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    // Plain-text fallback
    const text = clusters.length > 0
      ? clusters
          .map((cluster, i) => {
            const sourceCounts = cluster.sourceCounts instanceof Map 
              ? Object.fromEntries(cluster.sourceCounts) 
              : cluster.sourceCounts || {};
            const sourceNames = Object.keys(sourceCounts);
            return `${i + 1}. ${cluster.canonicalTitle}\n${cluster.summary}\nSources: ${sourceNames.join(', ')}\nView: https://synthoraai.vercel.app/clusters/${cluster._id}`;
          })
          .join("\n\n")
      : `Individual articles (clustering in progress):\n\n` +
        contentRows.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    // Send email and throttle to 2 requests/sec
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: sub.email,
      subject: `📰 ${contentDescription} for you`,
      html,
      text,
    });

    if (error) {
      console.error(`${sub.email}: FAILED –`, error);
      await delay(RATE_LIMIT_DELAY_MS);
      continue;
    }

    console.log(`${sub.email}: sent (${clusters.length > 0 ? 'clustered' : 'individual'})`);
    sub.lastSentAt = new Date();
    await sub.save();

    await delay(RATE_LIMIT_DELAY_MS);
  }

  await mongoose.disconnect();
  console.log("Newsletter sending complete");
}

/**
 * Main function
 */
async function main() {
  try {
    await sendClusterNewsletter();
  } catch (error) {
    console.error("Error sending newsletter:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}