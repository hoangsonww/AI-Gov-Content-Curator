/**
 * Tests for Zod schemas — validation correctness and edge cases.
 */

import {
  chatRequestSchema,
  articleProcessRequestSchema,
  batchProcessRequestSchema,
  chatResponseSchema,
  healthCheckSchema,
} from "../schemas/chat";

// ---------------------------------------------------------------------------
// chatRequestSchema
// ---------------------------------------------------------------------------

describe("chatRequestSchema", () => {
  const valid = {
    sessionId: "session-abc-123",
    message: "What are the latest policy changes?",
  };

  it("accepts a minimal valid payload", () => {
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("defaults stream to false when omitted", () => {
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success && result.data.stream).toBe(false);
  });

  it("accepts stream: true", () => {
    const result = chatRequestSchema.safeParse({ ...valid, stream: true });
    expect(result.success && result.data.stream).toBe(true);
  });

  it("accepts all three valid modes", () => {
    for (const mode of ["DIRECT", "TOOL_AUGMENTED", "AGENTIC"] as const) {
      const result = chatRequestSchema.safeParse({ ...valid, mode });
      expect(result.success).toBe(true);
      expect(result.success && result.data.mode).toBe(mode);
    }
  });

  it("rejects an invalid mode value", () => {
    const result = chatRequestSchema.safeParse({ ...valid, mode: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects empty sessionId", () => {
    const result = chatRequestSchema.safeParse({ ...valid, sessionId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects sessionId longer than 128 chars", () => {
    const result = chatRequestSchema.safeParse({
      ...valid,
      sessionId: "x".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("accepts sessionId exactly 128 chars", () => {
    const result = chatRequestSchema.safeParse({
      ...valid,
      sessionId: "x".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = chatRequestSchema.safeParse({ ...valid, message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects message longer than 32000 chars", () => {
    const result = chatRequestSchema.safeParse({
      ...valid,
      message: "x".repeat(32_001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts message exactly 32000 chars", () => {
    const result = chatRequestSchema.safeParse({
      ...valid,
      message: "x".repeat(32_000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts arbitrary metadata record", () => {
    const result = chatRequestSchema.safeParse({
      ...valid,
      metadata: { userId: "u1", extra: [1, 2, 3] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing message field", () => {
    const result = chatRequestSchema.safeParse({ sessionId: "s1" });
    expect(result.success).toBe(false);
  });

  it("rejects missing sessionId field", () => {
    const result = chatRequestSchema.safeParse({ message: "hello" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// articleProcessRequestSchema
// ---------------------------------------------------------------------------

describe("articleProcessRequestSchema", () => {
  const valid = {
    article: { id: "art-1", content: "Some article body text." },
    mode: "full",
    priority: 10,
  };

  it("accepts a complete valid payload", () => {
    expect(articleProcessRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults mode to 'full' when omitted", () => {
    const result = articleProcessRequestSchema.safeParse({
      article: valid.article,
    });
    expect(result.success && result.data.mode).toBe("full");
  });

  it("defaults priority to 0 when omitted", () => {
    const result = articleProcessRequestSchema.safeParse({
      article: valid.article,
    });
    expect(result.success && result.data.priority).toBe(0);
  });

  it("accepts all valid modes", () => {
    for (const mode of ["full", "fast", "enrich", "reprocess"] as const) {
      const result = articleProcessRequestSchema.safeParse({ ...valid, mode });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid mode", () => {
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, mode: "turbo" })
        .success,
    ).toBe(false);
  });

  it("rejects priority below 0", () => {
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, priority: -1 }).success,
    ).toBe(false);
  });

  it("rejects priority above 100", () => {
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, priority: 101 })
        .success,
    ).toBe(false);
  });

  it("accepts priority exactly 0 and 100", () => {
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, priority: 0 }).success,
    ).toBe(true);
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, priority: 100 })
        .success,
    ).toBe(true);
  });

  it("rejects a non-integer priority", () => {
    expect(
      articleProcessRequestSchema.safeParse({ ...valid, priority: 5.5 })
        .success,
    ).toBe(false);
  });

  it("accepts optional url and source on article", () => {
    const result = articleProcessRequestSchema.safeParse({
      article: {
        ...valid.article,
        url: "https://example.gov/article",
        source: "GAO",
        title: "Test Article",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed url on article", () => {
    const result = articleProcessRequestSchema.safeParse({
      article: { ...valid.article, url: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty article id", () => {
    expect(
      articleProcessRequestSchema.safeParse({
        article: { id: "", content: "text" },
      }).success,
    ).toBe(false);
  });

  it("rejects empty article content", () => {
    expect(
      articleProcessRequestSchema.safeParse({
        article: { id: "art-1", content: "" },
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// batchProcessRequestSchema
// ---------------------------------------------------------------------------

describe("batchProcessRequestSchema", () => {
  const article = { id: "art-1", content: "Some article body text." };

  it("accepts a batch with one article", () => {
    expect(
      batchProcessRequestSchema.safeParse({ articles: [article] }).success,
    ).toBe(true);
  });

  it("rejects an empty articles array", () => {
    expect(batchProcessRequestSchema.safeParse({ articles: [] }).success).toBe(
      false,
    );
  });

  it("rejects a batch with more than 100 articles", () => {
    const articles = Array.from({ length: 101 }, (_, i) => ({
      id: `art-${i}`,
      content: "text",
    }));
    expect(batchProcessRequestSchema.safeParse({ articles }).success).toBe(
      false,
    );
  });

  it("accepts exactly 100 articles", () => {
    const articles = Array.from({ length: 100 }, (_, i) => ({
      id: `art-${i}`,
      content: "text",
    }));
    expect(batchProcessRequestSchema.safeParse({ articles }).success).toBe(
      true,
    );
  });

  it("defaults mode to 'full'", () => {
    const result = batchProcessRequestSchema.safeParse({ articles: [article] });
    expect(result.success && result.data.mode).toBe("full");
  });
});

// ---------------------------------------------------------------------------
// healthCheckSchema
// ---------------------------------------------------------------------------

describe("healthCheckSchema", () => {
  const valid = {
    status: "healthy",
    providers: ["anthropic", "google"],
    warnings: [],
    budget: { totalUsd: 1.5, remainingUsd: 8.5, budgetUsd: 10 },
    uptime: 3600,
  };

  it("accepts a valid healthy payload", () => {
    expect(healthCheckSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all three statuses", () => {
    for (const status of ["healthy", "degraded", "unhealthy"] as const) {
      expect(healthCheckSchema.safeParse({ ...valid, status }).success).toBe(
        true,
      );
    }
  });

  it("rejects an unknown status", () => {
    expect(
      healthCheckSchema.safeParse({ ...valid, status: "ok" }).success,
    ).toBe(false);
  });

  it("rejects a missing budget field", () => {
    const { budget: _b, ...rest } = valid;
    expect(healthCheckSchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chatResponseSchema
// ---------------------------------------------------------------------------

describe("chatResponseSchema", () => {
  const valid = {
    content: "Here is your answer.",
    sessionId: "sess-001",
    intent: {
      query: "What is the policy?",
      intent: "article_qa",
      entities: ["policy"],
      confidence: 0.9,
    },
    agentId: "article-qa",
    metadata: {
      agentId: "article-qa",
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      timestamp: new Date().toISOString(),
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 300,
      retryCount: 0,
      estimatedCost: 0.0005,
    },
    grounding: { valid: true, warnings: [], score: 0.85 },
    handoffChain: ["supervisor", "article-qa"],
  };

  it("accepts a valid complete response", () => {
    expect(chatResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects if metadata is missing latencyMs", () => {
    const { latencyMs: _l, ...metaWithout } = valid.metadata;
    const result = chatResponseSchema.safeParse({
      ...valid,
      metadata: metaWithout,
    });
    expect(result.success).toBe(false);
  });

  it("rejects grounding score outside 0-1 when schema enforces it", () => {
    // The schema uses z.number() without .min/.max so value 2 is technically allowed
    // This test documents the current permissive behaviour
    const result = chatResponseSchema.safeParse({
      ...valid,
      grounding: { valid: true, warnings: [], score: 2 },
    });
    expect(result.success).toBe(true); // permissive — documented here
  });
});
