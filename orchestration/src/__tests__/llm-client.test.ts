/**
 * Tests for DualProviderClient — provider selection, getAvailableProviders,
 * timeout, retry logic, and failover.  All SDK calls are mocked; no real
 * network traffic is produced.
 */

import { DualProviderClient } from "../llm/dual-provider-client";
import { ModelProvider } from "../agents/types";
import type { AgentDefinition, Message } from "../agents/types";

// ---------------------------------------------------------------------------
// Mock the provider SDKs at module level
// ---------------------------------------------------------------------------

// We mock both SDK modules before any imports resolve them in the client.
jest.mock("@anthropic-ai/sdk", () => {
  const mockCreate = jest.fn();
  const mockStream = jest.fn();
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  }));
  (MockAnthropic as unknown as { _mockCreate: jest.Mock })._mockCreate =
    mockCreate;
  (MockAnthropic as unknown as { _mockStream: jest.Mock })._mockStream =
    mockStream;
  return { __esModule: true, default: MockAnthropic };
});

jest.mock("@google/generative-ai", () => {
  const mockSendMessage = jest.fn();
  const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
  const mockGetGenerativeModel = jest.fn(() => ({
    startChat: mockStartChat,
  }));
  const MockGoogleGenerativeAI = jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));
  (
    MockGoogleGenerativeAI as unknown as { _mockSendMessage: jest.Mock }
  )._mockSendMessage = mockSendMessage;
  return {
    __esModule: true,
    GoogleGenerativeAI: MockGoogleGenerativeAI,
  };
});

// Pull the mock constructor references so we can inspect/reset calls
const Anthropic = jest.requireMock("@anthropic-ai/sdk").default as jest.Mock;
const { GoogleGenerativeAI } = jest.requireMock(
  "@google/generative-ai",
) as { GoogleGenerativeAI: jest.Mock };

// ---------------------------------------------------------------------------
// Helpers to get the mocked API methods
// ---------------------------------------------------------------------------

// Return the stable mock fns the factories expose on the constructor.
// Indexing `mock.instances` is unreliable: the SDK clients are constructed
// lazily inside `generate()`, so no instance exists when a test wires its
// resolved value.
function getAnthropicMessagesCreate(): jest.Mock {
  return (Anthropic as unknown as { _mockCreate: jest.Mock })._mockCreate;
}

function getGoogleSendMessage(): jest.Mock {
  return (
    GoogleGenerativeAI as unknown as { _mockSendMessage: jest.Mock }
  )._mockSendMessage;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const anthropicAgent: AgentDefinition = {
  id: "test-anthropic",
  name: "Test Anthropic Agent",
  description: "Test",
  provider: ModelProvider.anthropic,
  model: "claude-haiku-4-5",
  capabilities: ["general_chat"],
  systemPrompt: "You are a test agent.",
  maxTokens: 256,
  temperature: 0.5,
};

const googleAgent: AgentDefinition = {
  id: "test-google",
  name: "Test Google Agent",
  description: "Test",
  provider: ModelProvider.google,
  model: "gemini-2.0-flash",
  capabilities: ["general_chat"],
  systemPrompt: "You are a test agent.",
  maxTokens: 256,
  temperature: 0.5,
};

const userMessages: Message[] = [{ role: "user", content: "Hello" }];

// Minimal valid Anthropic response shape
const anthropicResponse = {
  content: [{ type: "text", text: "Anthropic reply" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 5 },
};

// Minimal valid Google response shape
const googleResponse = {
  response: {
    text: () => "Google reply",
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      cachedContentTokenCount: 0,
    },
  },
};

// ---------------------------------------------------------------------------
// getAvailableProviders
// ---------------------------------------------------------------------------

// Guarantee a clean provider environment for every test. Provider keys are
// supplied explicitly via constructor config in the tests that need them;
// tests that exercise the "not configured" path rely on genuine absence.
// (A prior `process.env.X = savedValue` restore pattern wrote the literal
// string "undefined" back when the saved value was undefined, which made
// `this.google` truthy and silently triggered provider failover.)
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

describe("DualProviderClient.getAvailableProviders", () => {
  it("returns both providers when both API keys are supplied", () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      googleApiKey: "goog-key",
    });
    const providers = client.getAvailableProviders();
    expect(providers).toContain(ModelProvider.anthropic);
    expect(providers).toContain(ModelProvider.google);
  });

  it("returns only anthropic when only anthropicApiKey is supplied", () => {
    const client = new DualProviderClient({ anthropicApiKey: "ant-key" });
    const providers = client.getAvailableProviders();
    expect(providers).toContain(ModelProvider.anthropic);
    expect(providers).not.toContain(ModelProvider.google);
  });

  it("returns only google when only googleApiKey is supplied", () => {
    const client = new DualProviderClient({ googleApiKey: "goog-key" });
    const providers = client.getAvailableProviders();
    expect(providers).not.toContain(ModelProvider.anthropic);
    expect(providers).toContain(ModelProvider.google);
  });

  it("returns an empty array when no API keys are supplied and env vars are absent", () => {
    const client = new DualProviderClient();
    expect(client.getAvailableProviders()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generate — Anthropic path
// ---------------------------------------------------------------------------

describe("DualProviderClient.generate — Anthropic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls Anthropic messages.create and returns parsed result", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    getAnthropicMessagesCreate().mockResolvedValueOnce(anthropicResponse);

    const result = await client.generate({
      agent: anthropicAgent,
      messages: userMessages,
    });

    expect(result.content).toBe("Anthropic reply");
    expect(result.metadata.model).toBe("claude-haiku-4-5");
    expect(result.metadata.provider).toBe(ModelProvider.anthropic);
    expect(result.metadata.inputTokens).toBe(10);
    expect(result.metadata.outputTokens).toBe(5);
    expect(result.stopReason).toBe("end_turn");
  });

  it("throws ProviderUnavailableError when anthropic client is not configured", async () => {
    const client = new DualProviderClient({
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    await expect(
      client.generate({ agent: anthropicAgent, messages: userMessages }),
    ).rejects.toThrow("anthropic provider is not configured");
  });

  it("includes retryCount=0 on the first successful attempt", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    getAnthropicMessagesCreate().mockResolvedValueOnce(anthropicResponse);
    const result = await client.generate({
      agent: anthropicAgent,
      messages: userMessages,
    });
    expect(result.metadata.retryCount).toBe(0);
  });

  it("calculates estimatedCost correctly using MODEL_PRICING", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    // claude-haiku-4-5: $0.8/M input, $4/M output
    // 10 input + 5 output = 8e-6 + 20e-6 = 28e-6
    getAnthropicMessagesCreate().mockResolvedValueOnce(anthropicResponse);
    const result = await client.generate({
      agent: anthropicAgent,
      messages: userMessages,
    });

    const expectedCost = (10 / 1_000_000) * 0.8 + (5 / 1_000_000) * 4;
    expect(result.metadata.estimatedCost).toBeCloseTo(expectedCost, 8);
  });
});

// ---------------------------------------------------------------------------
// generate — Google path
// ---------------------------------------------------------------------------

describe("DualProviderClient.generate — Google", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls Google chat.sendMessage and returns parsed result", async () => {
    const client = new DualProviderClient({
      googleApiKey: "goog-key",
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    getGoogleSendMessage().mockResolvedValueOnce(googleResponse);

    const result = await client.generate({
      agent: googleAgent,
      messages: userMessages,
    });

    expect(result.content).toBe("Google reply");
    expect(result.metadata.provider).toBe(ModelProvider.google);
  });

  it("throws when the conversation does not end with a user message", async () => {
    const client = new DualProviderClient({
      googleApiKey: "goog-key",
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    const badMessages: Message[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" }, // last msg is assistant
    ];

    await expect(
      client.generate({ agent: googleAgent, messages: badMessages }),
    ).rejects.toThrow("Conversation must end with a user message");
  });

  it("throws ProviderUnavailableError when google client is not configured", async () => {
    const client = new DualProviderClient({
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    await expect(
      client.generate({ agent: googleAgent, messages: userMessages }),
    ).rejects.toThrow("google provider is not configured");
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("DualProviderClient — timeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects with a timeout error when the provider call hangs", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      timeoutMs: 100,
      defaultRetryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitter: false },
    });

    // Mock a promise that never resolves
    getAnthropicMessagesCreate().mockReturnValueOnce(new Promise(() => {}));

    const generatePromise = client.generate({
      agent: anthropicAgent,
      messages: userMessages,
    });

    jest.advanceTimersByTime(200);

    await expect(generatePromise).rejects.toThrow("timed out after 100ms");
  });
});

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

describe("DualProviderClient — retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries the configured number of times before throwing", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      defaultRetryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        jitter: false,
      },
    });

    const mockCreate = getAnthropicMessagesCreate();
    mockCreate.mockRejectedValue(new Error("transient error"));

    await expect(
      client.generate({ agent: anthropicAgent, messages: userMessages }),
    ).rejects.toThrow("transient error");

    // Should have been called 3 times total (initial + 2 retries)
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("succeeds on the second attempt when first fails", async () => {
    const client = new DualProviderClient({
      anthropicApiKey: "ant-key",
      defaultRetryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        jitter: false,
      },
    });

    const mockCreate = getAnthropicMessagesCreate();
    mockCreate
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce(anthropicResponse);

    const result = await client.generate({
      agent: anthropicAgent,
      messages: userMessages,
    });

    expect(result.content).toBe("Anthropic reply");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
