import { generateNGrams, simpleHash, jaccardSimilarity } from '../utils/textNormalization';

/**
 * MinHash implementation for fast approximate Jaccard similarity
 */
export class MinHash {
  private hashes: number[];
  private numHashes: number;

  constructor(numHashes: number = 128) {
    this.numHashes = numHashes;
    this.hashes = new Array(numHashes).fill(Infinity);
  }

  /**
   * Update MinHash with a set of items (typically n-grams)
   */
  update(items: string[]): void {
    for (const item of items) {
      for (let i = 0; i < this.numHashes; i++) {
        const hash = simpleHash(item, i);
        if (hash < this.hashes[i]) {
          this.hashes[i] = hash;
        }
      }
    }
  }

  /**
   * Calculate Jaccard similarity estimate with another MinHash
   */
  similarity(other: MinHash): number {
    if (this.numHashes !== other.numHashes) {
      throw new Error('MinHash objects must have the same number of hashes');
    }

    let matches = 0;
    for (let i = 0; i < this.numHashes; i++) {
      if (this.hashes[i] === other.hashes[i]) {
        matches++;
      }
    }

    return matches / this.numHashes;
  }

  /**
   * Get the hash signature as a string for storage
   */
  getSignature(): string {
    return this.hashes.join(',');
  }

  /**
   * Create MinHash from a stored signature string
   */
  static fromSignature(signature: string): MinHash {
    const hashes = signature.split(',').map(Number);
    const minhash = new MinHash(hashes.length);
    minhash.hashes = hashes;
    return minhash;
  }

  /**
   * Create MinHash from text content using n-grams
   */
  static fromText(text: string, ngramSize: number = 5, numHashes: number = 128): MinHash {
    const minhash = new MinHash(numHashes);
    const ngrams = generateNGrams(text, ngramSize);
    minhash.update(ngrams);
    return minhash;
  }
}

/**
 * Locality Sensitive Hashing (LSH) for fast similarity search
 */
export class LSHIndex {
  private bands: Map<string, Set<string>>[];
  private numBands: number;
  private hashesPerBand: number;

  constructor(numHashes: number = 128, numBands: number = 16) {
    this.numBands = numBands;
    this.hashesPerBand = Math.floor(numHashes / numBands);
    this.bands = Array.from({ length: numBands }, () => new Map());
  }

  /**
   * Add a MinHash signature to the index
   */
  add(id: string, minhash: MinHash): void {
    const signature = minhash.getSignature().split(',').map(Number);
    
    for (let band = 0; band < this.numBands; band++) {
      const start = band * this.hashesPerBand;
      const end = start + this.hashesPerBand;
      const bandSignature = signature.slice(start, end).join(',');
      
      if (!this.bands[band].has(bandSignature)) {
        this.bands[band].set(bandSignature, new Set());
      }
      this.bands[band].get(bandSignature)!.add(id);
    }
  }

  /**
   * Find candidate similar items for a given MinHash
   */
  getCandidates(minhash: MinHash): Set<string> {
    const candidates = new Set<string>();
    const signature = minhash.getSignature().split(',').map(Number);
    
    for (let band = 0; band < this.numBands; band++) {
      const start = band * this.hashesPerBand;
      const end = start + this.hashesPerBand;
      const bandSignature = signature.slice(start, end).join(',');
      
      const bucket = this.bands[band].get(bandSignature);
      if (bucket) {
        bucket.forEach(id => candidates.add(id));
      }
    }
    
    return candidates;
  }

  /**
   * Remove an item from the index
   */
  remove(id: string, minhash: MinHash): void {
    const signature = minhash.getSignature().split(',').map(Number);
    
    for (let band = 0; band < this.numBands; band++) {
      const start = band * this.hashesPerBand;
      const end = start + this.hashesPerBand;
      const bandSignature = signature.slice(start, end).join(',');
      
      const bucket = this.bands[band].get(bandSignature);
      if (bucket) {
        bucket.delete(id);
        if (bucket.size === 0) {
          this.bands[band].delete(bandSignature);
        }
      }
    }
  }
}

/**
 * TF-IDF Vector implementation for more precise similarity
 */
export class TFIDFVector {
  private vector: Map<string, number>;
  private magnitude: number;

  constructor(termFreqs: Map<string, number>, documentFreqs: Map<string, number>, totalDocs: number) {
    this.vector = new Map();
    this.magnitude = 0;

    // Calculate TF-IDF for each term
    for (const [term, tf] of termFreqs) {
      const df = documentFreqs.get(term) || 1;
      const idf = Math.log(totalDocs / df);
      const tfidf = tf * idf;
      this.vector.set(term, tfidf);
      this.magnitude += tfidf * tfidf;
    }

    this.magnitude = Math.sqrt(this.magnitude);
  }

  /**
   * Calculate cosine similarity with another TF-IDF vector
   */
  cosineSimilarity(other: TFIDFVector): number {
    if (this.magnitude === 0 || other.magnitude === 0) return 0;

    let dotProduct = 0;
    for (const [term, weight] of this.vector) {
      const otherWeight = other.vector.get(term) || 0;
      dotProduct += weight * otherWeight;
    }

    return dotProduct / (this.magnitude * other.magnitude);
  }

  /**
   * Get the vector as a string for storage
   */
  getSignature(): string {
    const entries = Array.from(this.vector.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([term, weight]) => `${term}:${weight.toFixed(6)}`)
      .join(',');
    return entries;
  }

  /**
   * Create TF-IDF vector from a stored signature string
   */
  static fromSignature(signature: string): TFIDFVector {
    const vector = new Map<string, number>();
    let magnitude = 0;

    if (signature) {
      const entries = signature.split(',');
      for (const entry of entries) {
        const [term, weightStr] = entry.split(':');
        const weight = parseFloat(weightStr);
        vector.set(term, weight);
        magnitude += weight * weight;
      }
    }

    const tfidf = Object.create(TFIDFVector.prototype);
    tfidf.vector = vector;
    tfidf.magnitude = Math.sqrt(magnitude);
    return tfidf;
  }

  /**
   * Create TF-IDF vector from text content
   */
  static fromText(text: string, documentFreqs: Map<string, number>, totalDocs: number): TFIDFVector {
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const termFreqs = new Map<string, number>();

    // Calculate term frequencies
    for (const word of words) {
      termFreqs.set(word, (termFreqs.get(word) || 0) + 1);
    }

    return new TFIDFVector(termFreqs, documentFreqs, totalDocs);
  }
}