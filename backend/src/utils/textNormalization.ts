/**
 * Text normalization utilities for clustering and similarity detection
 */

/**
 * Normalize text for similarity comparison by:
 * - Converting to lowercase
 * - Removing extra whitespace
 * - Normalizing quotes and punctuation
 * - Removing common boilerplate patterns
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    // Convert to lowercase
    .toLowerCase()
    // Normalize quotes
    .replace(/[""'']/g, '"')
    .replace(/['']/g, "'")
    // Remove tracking parameters and URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove common boilerplate patterns
    .replace(/\(reuters\)/gi, '')
    .replace(/\(ap\)/gi, '')
    .replace(/\(afp\)/gi, '')
    .replace(/by [a-z\s]+ \| /gi, '')
    .replace(/published [\d\w\s:,-]+/gi, '')
    .replace(/updated [\d\w\s:,-]+/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a lead/summary from article content (first few sentences)
 */
export function extractLead(content: string, maxLength: number = 300): string {
  if (!content) return '';
  
  // Split into sentences and take first few
  const sentences = content.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  let lead = '';
  for (const sentence of sentences) {
    if ((lead + sentence).length > maxLength) break;
    lead += (lead ? '. ' : '') + sentence;
  }
  
  return lead || content.slice(0, maxLength);
}

/**
 * Remove common URL parameters that don't affect content
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove tracking parameters
    const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Generate n-grams from text for similarity detection
 */
export function generateNGrams(text: string, n: number = 5): string[] {
  if (!text || text.length < n) return [];
  
  const ngrams: string[] = [];
  const normalized = normalizeText(text);
  
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.slice(i, i + n));
  }
  
  return ngrams;
}

/**
 * Create a simple hash of a string (for MinHash implementation)
 */
export function simpleHash(str: string, seed: number = 0): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}