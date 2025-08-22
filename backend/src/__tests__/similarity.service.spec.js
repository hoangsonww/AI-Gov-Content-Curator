const { MinHash, LSHIndex, TFIDFVector } = require("../services/similarity.service");

describe("Similarity Service", () => {
  describe("MinHash", () => {
    test("should create MinHash from text", () => {
      const text = "This is a test document for similarity testing";
      const minhash = MinHash.fromText(text);
      
      expect(minhash.getSignature()).toBeDefined();
      expect(minhash.getSignature().split(',').length).toBe(128); // default numHashes
    });

    test("should calculate similarity between similar texts", () => {
      const text1 = "This is a test document for similarity testing";
      const text2 = "This is a test document for similarity checking"; // very similar
      
      const minhash1 = MinHash.fromText(text1);
      const minhash2 = MinHash.fromText(text2);
      
      const similarity = minhash1.similarity(minhash2);
      expect(similarity).toBeGreaterThan(0.5); // Should be quite similar
    });

    test("should calculate low similarity between different texts", () => {
      const text1 = "This is about government policy and regulations";
      const text2 = "Sports news and entertainment updates today";
      
      const minhash1 = MinHash.fromText(text1);
      const minhash2 = MinHash.fromText(text2);
      
      const similarity = minhash1.similarity(minhash2);
      expect(similarity).toBeLessThan(0.3); // Should be quite different
    });

    test("should recreate MinHash from signature", () => {
      const text = "Test document for signature recreation";
      const original = MinHash.fromText(text);
      const signature = original.getSignature();
      
      const recreated = MinHash.fromSignature(signature);
      expect(recreated.getSignature()).toBe(signature);
      expect(original.similarity(recreated)).toBe(1.0);
    });
  });

  describe("LSHIndex", () => {
    test("should add and retrieve candidates", () => {
      const index = new LSHIndex(128, 16);
      const text = "Test document for LSH indexing";
      const minhash = MinHash.fromText(text);
      
      index.add("doc1", minhash);
      const candidates = index.getCandidates(minhash);
      
      expect(candidates.has("doc1")).toBe(true);
    });

    test("should find similar documents", () => {
      const index = new LSHIndex(128, 16);
      
      const text1 = "This is a test document for similarity testing";
      const text2 = "This is a test document for similarity checking"; // similar
      const text3 = "Completely different content about sports";
      
      const minhash1 = MinHash.fromText(text1);
      const minhash2 = MinHash.fromText(text2);
      const minhash3 = MinHash.fromText(text3);
      
      index.add("doc1", minhash1);
      index.add("doc3", minhash3);
      
      const candidates = index.getCandidates(minhash2);
      // Should find doc1 as similar, but might not find doc3
      expect(candidates.size).toBeGreaterThan(0);
    });

    test("should remove documents from index", () => {
      const index = new LSHIndex(128, 16);
      const text = "Test document for removal";
      const minhash = MinHash.fromText(text);
      
      index.add("doc1", minhash);
      expect(index.getCandidates(minhash).has("doc1")).toBe(true);
      
      index.remove("doc1", minhash);
      expect(index.getCandidates(minhash).has("doc1")).toBe(false);
    });
  });

  describe("TFIDFVector", () => {
    test("should create TF-IDF vector from text", () => {
      const text = "test document for tfidf calculation";
      const docFreqs = new Map([
        ["test", 2],
        ["document", 3],
        ["for", 5],
        ["tfidf", 1],
        ["calculation", 2]
      ]);
      const totalDocs = 10;
      
      const vector = TFIDFVector.fromText(text, docFreqs, totalDocs);
      expect(vector.getSignature()).toBeDefined();
    });

    test("should calculate cosine similarity", () => {
      const docFreqs = new Map([
        ["test", 2], ["document", 3], ["for", 5], ["similarity", 1]
      ]);
      const totalDocs = 10;
      
      const text1 = "test document for similarity";
      const text2 = "test document for similarity testing";
      const text3 = "completely different content";
      
      const vector1 = TFIDFVector.fromText(text1, docFreqs, totalDocs);
      const vector2 = TFIDFVector.fromText(text2, docFreqs, totalDocs);
      const vector3 = TFIDFVector.fromText(text3, docFreqs, totalDocs);
      
      const sim12 = vector1.cosineSimilarity(vector2);
      const sim13 = vector1.cosineSimilarity(vector3);
      
      expect(sim12).toBeGreaterThan(sim13); // Similar texts should have higher similarity
    });

    test("should recreate TF-IDF vector from signature", () => {
      const docFreqs = new Map([["test", 2], ["document", 3]]);
      const totalDocs = 10;
      const text = "test document";
      
      const original = TFIDFVector.fromText(text, docFreqs, totalDocs);
      const signature = original.getSignature();
      
      const recreated = TFIDFVector.fromSignature(signature);
      expect(original.cosineSimilarity(recreated)).toBeCloseTo(1.0, 5);
    });

    test("should handle empty vectors", () => {
      const empty1 = TFIDFVector.fromSignature("");
      const empty2 = TFIDFVector.fromSignature("");
      
      expect(empty1.cosineSimilarity(empty2)).toBe(0);
    });
  });
});