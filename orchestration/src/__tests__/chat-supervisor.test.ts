/**
 * Tests for ChatSupervisor — routing, budget enforcement, intent classification
 * fallback, session management, health check.  All LLM calls are mocked.
 */

import { ChatSupervisor } from "../supervisor/chat-supervisor";
import { ModelProvider } from "../agents/types";

// ---------------------------------------------------------------------------
// Mock both provider SDKs so ChatSupervisor construction never needs real keys
// ---------------------------------------------------------------------------

jest.mock("@anthropic-ai/sdk", () => {
  const mockCreate = jest.fn();
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate, stream: jest.fn() },
  }));
  return { __esModule: true, default: MockAnthropic };
});

jest.mock("@google/generative-ai", () => {
  const mockSendMessage = jest.fn();
  const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
  const mockGetModel = jest.fn(() => ({ startChat: mockStartChat }));
  const MockGoogle = jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetModel,
  }));
  return { __esModule: true, GoogleGenerativeAI: MockGoogle };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Anthropic = jest.requireMock("@anthropic-ai/sdk").default as jest.Mock;
const { GoogleGenerativeAI } = jest.requireMock(
  "@google/generative-ai",
) as { GoogleGenerativeAI: jest.Mock };

function getAnthropicCreate(): jest.Mock {
  const inst = Anthropic.mock.instances[Anthropic.mock.instances.length - 1] as {
    messages: { create: jest.Mock };
  };
  return inst?.messages?.create ?? jest.fn();
}

function getGoogleSend(): jest.Mock {
  const inst = GoogleGenerativeAI.mock.instances[
    GoogleGenerativeAI.mock.instances.length - 1
  ] as { getGenerativeModel: () => { startChat: () => { sendMessage: jest.Mock } } };
  return inst?.getGenerativeModel()?.startChat()?.sendMessage ?? jest.fn();
}

// Minimal valid LLM responses
const intentClassificationJson = JSON.stringify({
  intent: "general_chat",
  entities: [],
  dateRange: null,
  source: null,
  confidence: 0.9,
});

const anthropicIntentResponse = {
  content: [{ type: "text", text: intentClassificationJson }],
  stop_reason: "end_turn",
  usage: { input_tokens: 20, output_tokens: 30 },
};

const anthropicChatResponse = {
  content: [{ type: "text", text: "Here is your answer about the topic." }],
  stop_reason: "end_turn",
  usage: { input_tokens: 100, output_tokens: 50 },
};

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

// Guarantee a clean provider environment for every test. Provider keys are
// supplied explicitly via constructor config; tests for the "no provider"
// path rely on genuine absence. (A prior `process.env.X = savedValue`
// restore wrote the literal string "undefined" back, making the Google
// client construct unexpectedly and triggering provider failover/hangs.)
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

// Single attempt, zero backoff: keeps failure-path tests deterministic and
// fast. Without it the default retry policy spends real seconds on
// exponential backoff and races the 5s jest timeout.
const FAST_RETRY = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  jitter: false,
};

describe("ChatSupervisor.healthCheck", () => {
  afterEach(() => jest.clearAllMocks());

  it("reports unhealthy when no providers are configured", () => {
    const supervisor = new ChatSupervisor();
    const health = supervisor.healthCheck();
    expect(health.status).toBe("unhealthy");
    expect(health.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("No LLM providers")]),
    );
  });

  it("reports degraded when only one provider is configured", () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
    });
    const health = supervisor.healthCheck();
    expect(health.status).toBe("degraded");
    expect(health.warnings.some((w) => w.includes("Only"))).toBe(true);
  });

  it("reports healthy when both providers are configured", () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", googleApiKey: "goog-key" },
    });
    const health = supervisor.healthCheck();
    expect(health.status).toBe("healthy");
    expect(health.warnings).toHaveLength(0);
  });

  it("returns budget information in health check", () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
      dailyBudgetUsd: 5,
    });
    const health = supervisor.healthCheck();
    expect(health.budget.budgetUsd).toBe(5);
    expect(health.budget.remainingUsd).toBe(5);
    expect(health.budget.totalUsd).toBe(0);
  });

  it("includes provider names in health check", () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", googleApiKey: "goog-key" },
    });
    const health = supervisor.healthCheck();
    expect(health.providers).toContain("anthropic");
    expect(health.providers).toContain("google");
  });
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe("ChatSupervisor — session management", () => {
  afterEach(() => jest.clearAllMocks());

  it("getSessionState creates and returns a session", () => {
    const supervisor = new ChatSupervisor();
    const state = supervisor.getSessionState("sess-new");
    expect(state).toBeDefined();
    expect(state!.sessionId).toBe("sess-new");
  });

  it("deleteSession removes the session and returns true", () => {
    const supervisor = new ChatSupervisor();
    supervisor.getSessionState("sess-to-del");
    expect(supervisor.deleteSession("sess-to-del")).toBe(true);
  });

  it("deleteSession returns false for unknown session", () => {
    const supervisor = new ChatSupervisor();
    expect(supervisor.deleteSession("ghost")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getCostSnapshot
// ---------------------------------------------------------------------------

describe("ChatSupervisor.getCostSnapshot", () => {
  it("returns a zero-spend snapshot on a fresh supervisor", () => {
    const supervisor = new ChatSupervisor({ dailyBudgetUsd: 5 });
    const snap = supervisor.getCostSnapshot();
    expect(snap.totalUsd).toBe(0);
    expect(snap.budgetUsd).toBe(5);
    expect(snap.remainingUsd).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getAvailableProviders
// ---------------------------------------------------------------------------

describe("ChatSupervisor.getAvailableProviders", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns anthropic when key supplied", () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
    });
    expect(supervisor.getAvailableProviders()).toContain(ModelProvider.anthropic);
  });

  it("returns empty array when no keys supplied and no env vars", () => {
    const supervisor = new ChatSupervisor();
    expect(supervisor.getAvailableProviders()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getRegistry
// ---------------------------------------------------------------------------

describe("ChatSupervisor.getRegistry", () => {
  it("returns the default registry with 16 agents", () => {
    const supervisor = new ChatSupervisor();
    const registry = supervisor.getRegistry();
    expect(registry.listAll()).toHaveLength(16);
  });
});

// ---------------------------------------------------------------------------
// chat — with mocked Anthropic responses
// ---------------------------------------------------------------------------

describe("ChatSupervisor.chat", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns a SupervisorResponse with the generated content", async () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
    });

    const mockCreate = getAnthropicCreate();
    // First call: intent classification; second call: chat response
    mockCreate
      .mockResolvedValueOnce(anthropicIntentResponse)
      .mockResolvedValueOnce(anthropicChatResponse);

    const response = await supervisor.chat("sess-1", "Tell me about policy X.");
    expect(response.sessionId).toBe("sess-1");
    expect(typeof response.content).toBe("string");
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.intent).toBeDefined();
    expect(response.metadata).toBeDefined();
    expect(Array.isArray(response.handoffChain)).toBe(true);
    expect(typeof response.grounding.score).toBe("number");
  });

  it("uses fallback intent when intent classification fails", async () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
    });

    const mockCreate = getAnthropicCreate();
    // First call: classification fails; second call: chat response
    mockCreate
      .mockRejectedValueOnce(new Error("classification failed"))
      .mockResolvedValueOnce(anthropicChatResponse);

    const response = await supervisor.chat("sess-2", "Search for climate articles");
    // Fallback heuristic: "search" keyword → article_search intent
    expect(response.intent.intent).toBe("article_search");
    expect(response.content.length).toBeGreaterThan(0);
  });

  it("uses fallback intent heuristic for bias keyword", async () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
    });

    const mockCreate = getAnthropicCreate();
    mockCreate
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(anthropicChatResponse);

    const response = await supervisor.chat("sess-3", "analyze bias in this article");
    expect(response.intent.intent).toBe("bias_analysis");
  });

  it("returns a structured error response when generation fails entirely", async () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
      // Single attempt so the test doesn't retry
    });

    const mockCreate = getAnthropicCreate();
    mockCreate.mockRejectedValue(new Error("total failure"));

    const response = await supervisor.chat("sess-err", "any question");
    // The supervisor catches the error and returns a fallback response
    expect(response.content).toContain("error");
    expect(response.sessionId).toBe("sess-err");
    expect(response.metadata.estimatedCost).toBe(0);
  });

  it("returns budget-exceeded response when daily budget is 0", async () => {
    const supervisor = new ChatSupervisor({
      llm: { anthropicApiKey: "ant-key", defaultRetryPolicy: FAST_RETRY },
      dailyBudgetUsd: 0,
    });

    const mockCreate = getAnthropicCreate();
    // Intent classification still fires; budget check happens after routing
    mockCreate.mockResolvedValueOnce(anthropicIntentResponse);

    const response = await supervisor.chat("sess-budget", "any question");
    expect(response.content).toContain("budget");
    expect(response.metadata.estimatedCost).toBe(0);
  });
});
