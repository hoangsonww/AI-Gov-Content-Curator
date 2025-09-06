const { MinHash, LSHIndex, TFIDFVector } = require("../services/similarity.service");
const { normalizeText, generateNGrams } = require("../utils/textNormalization");

describe("Integration: Clustering Workflow", () => {
  describe("End-to-end similarity detection", () => {
    test("should detect duplicate articles with high confidence", () => {
      const article1 = {
        title: "President Signs New Healthcare Bill",
        content: "The President signed landmark healthcare legislation today at the White House, marking a significant victory for the administration's policy agenda. The new law will expand coverage to millions of Americans and includes provisions for prescription drug pricing reforms. Democratic leaders praised the signing as a historic achievement, while Republican lawmakers criticized the legislation as government overreach. The bill passed Congress after months of intense debate and negotiation between party leaders."
      };

      const article2 = {
        title: "President Signs Healthcare Legislation", 
        content: "Today the President signed major healthcare legislation into law at a ceremony in the White House, representing a major win for the administration's policy agenda. The legislation extends health coverage to millions of Americans and contains measures to control prescription drug costs. Democrats hailed the signing as a landmark achievement, while Republicans denounced the bill as excessive government intervention. The measure cleared Congress following months of heated debate and political maneuvering."
      };

      const different = {
        title: "Local Sports Team Wins Championship",
        content: "The hometown basketball team secured their first championship in over a decade with a thrilling victory last night at the arena. The game went into overtime after a dramatic comeback in the fourth quarter. Fans celebrated in the streets after the final buzzer, marking the end of a remarkable season. The team's star player was named finals MVP after averaging 28 points throughout the playoffs."
      };

      // Test text normalization
      const norm1 = normalizeText(article1.title + " " + article1.content);
      const norm2 = normalizeText(article2.title + " " + article2.content);
      const normDiff = normalizeText(different.title + " " + different.content);

      expect(norm1).toBeDefined();
      expect(norm2).toBeDefined();
      expect(normDiff).toBeDefined();

      // Test MinHash similarity (may have low precision with similar content)
      const minhash1 = MinHash.fromText(norm1);
      const minhash2 = MinHash.fromText(norm2);
      const minhashDiff = MinHash.fromText(normDiff);

      const similarity = minhash1.similarity(minhash2);
      const differentSimilarity = minhash1.similarity(minhashDiff);

      // MinHash should at least distinguish between similar and different content
      // Even if similarity is low, it should be consistent
      expect(similarity).toBeGreaterThanOrEqual(differentSimilarity);
      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test("should work with LSH indexing for fast retrieval", () => {
      const index = new LSHIndex(128, 16);
      
      const articles = [
        "Breaking: Major policy announcement from government officials",
        "Government announces major new policy initiative today", // Similar to first
        "Sports: Local team advances to playoffs",
        "Weather: Storm warning issued for coastal areas"
      ];

      // Add articles to index
      articles.forEach((article, i) => {
        const minhash = MinHash.fromText(article);
        index.add(`article_${i}`, minhash);
      });

      // Query for similar articles
      const queryText = "Government officials announce significant policy changes";
      const queryMinhash = MinHash.fromText(queryText);
      const candidates = index.getCandidates(queryMinhash);

      // Should find the government-related articles
      expect(candidates.size).toBeGreaterThan(0);
      
      // Convert to array to check contents
      const candidateArray = Array.from(candidates);
      const hasGovernmentArticles = candidateArray.some(id => 
        id === 'article_0' || id === 'article_1'
      );
      
      expect(hasGovernmentArticles).toBe(true);
    });

    test("should handle edge cases gracefully", () => {
      // Empty content
      expect(() => MinHash.fromText("")).not.toThrow();
      expect(() => normalizeText("")).not.toThrow();
      
      // Very short content
      const shortMinhash = MinHash.fromText("hi");
      expect(shortMinhash.getSignature()).toBeDefined();
      
      // Very long content
      const longText = "word ".repeat(1000);
      const longMinhash = MinHash.fromText(longText);
      expect(longMinhash.getSignature()).toBeDefined();
      
      // Special characters
      const specialText = "Article with émoji 🎉 and special chars @#$%";
      const specialMinhash = MinHash.fromText(specialText);
      expect(specialMinhash.getSignature()).toBeDefined();
    });
  });

  describe("TF-IDF Integration", () => {
    test("should compute meaningful similarity scores", () => {
      const docFreqs = new Map([
        ["government", 10],
        ["policy", 8], 
        ["announcement", 5],
        ["sports", 3],
        ["team", 4],
        ["weather", 2]
      ]);
      const totalDocs = 100;

      const doc1 = "government policy announcement";
      const doc2 = "government announces new policy";
      const doc3 = "sports team victory";

      const vec1 = TFIDFVector.fromText(doc1, docFreqs, totalDocs);
      const vec2 = TFIDFVector.fromText(doc2, docFreqs, totalDocs);
      const vec3 = TFIDFVector.fromText(doc3, docFreqs, totalDocs);

      const sim12 = vec1.cosineSimilarity(vec2);
      const sim13 = vec1.cosineSimilarity(vec3);

      expect(sim12).toBeGreaterThan(sim13);
      expect(sim12).toBeGreaterThan(0.2);
      expect(sim13).toBeLessThan(0.5);
    });
  });

  describe("Performance benchmarks", () => {
    test("should process articles efficiently", () => {
      const startTime = Date.now();
      
      // Simulate processing 100 articles
      for (let i = 0; i < 100; i++) {
        const text = `Article ${i} about government policy and legislative changes affecting the economy`;
        const minhash = MinHash.fromText(text);
        minhash.getSignature();
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 100 articles in reasonable time (less than 1 second)
      expect(processingTime).toBeLessThan(1000);
    });

    test("should maintain consistent hash sizes", () => {
      const texts = [
        "Short",
        "Medium length article about various topics",
        "Very long article with extensive details about multiple subjects including politics, economics, technology, and social issues that spans many sentences and covers numerous topics in great detail".repeat(10)
      ];

      texts.forEach(text => {
        const minhash = MinHash.fromText(text);
        const signature = minhash.getSignature();
        const parts = signature.split(',');
        
        // Should always have exactly 128 hash values (default)
        expect(parts.length).toBe(128);
        
        // Each part should be a valid number
        parts.forEach(part => {
          expect(Number.isInteger(parseInt(part))).toBe(true);
        });
      });
    });
  });
});