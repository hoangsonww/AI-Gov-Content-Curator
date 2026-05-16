/**
 * Tests for PromptCacheStrategy — layered prompt construction and cache
 * savings estimation. Pure logic; no SDK or network.
 */

import { PromptCacheStrategy } from "../agents/prompts/cache-strategy";
import { ModelProvider } from "../agents/types";
import type { AgentDefinition, Message } from "../agents/types";

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent.",
    provider: ModelProvider.anthropic,
    model: "claude-sonnet-4-6",
    capabilities: ["general_chat"],
    systemPrompt: "You are a helpful assistant.",
    ...overrides,
  };
}

const grounding = ["Always cite sources.", "Never fabricate facts."];

describe("PromptCacheStrategy.buildCachedPrompt", () => {
  const strategy = new PromptCacheStrategy();

  it("marks the stable layers with ephemeral cache_control", () => {
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, "", []);
    const cached = prompt.system.filter((b) => b.cache_control);
    expect(cached.length).toBeGreaterThanOrEqual(2);
    for (const block of cached) {
      expect(block.cache_control).toEqual({ type: "ephemeral" });
    }
  });

  it("includes a tool layer only when the agent has tools", () => {
    const withTools = strategy.buildCachedPrompt(
      makeAgent({ tools: ["search", "fetch"] }),
      grounding,
      "",
      [],
    );
    expect(withTools.system.some((b) => b.text.includes("Available Tools"))).toBe(true);

    const withoutTools = strategy.buildCachedPrompt(makeAgent(), grounding, "", []);
    expect(withoutTools.system.some((b) => b.text.includes("Available Tools"))).toBe(false);
  });

  it("embeds the grounding rules and system prompt", () => {
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, "", []);
    const allText = prompt.system.map((b) => b.text).join("\n");
    expect(allText).toContain("Always cite sources.");
    expect(allText).toContain("You are a helpful assistant.");
  });

  it("does not cache a trivially short conversation summary", () => {
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, "short", []);
    const summaryBlock = prompt.system.find((b) => b.text.includes("Conversation Summary"));
    expect(summaryBlock).toBeDefined();
    expect(summaryBlock?.cache_control).toBeUndefined();
  });

  it("caches a substantial conversation summary", () => {
    const longSummary = "x".repeat(250);
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, longSummary, []);
    const summaryBlock = prompt.system.find((b) => b.text.includes("Conversation Summary"));
    expect(summaryBlock?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("keeps only user and assistant turns in messages", () => {
    const messages: Message[] = [
      { role: "system", content: "ignored" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "tool", content: "ignored too" },
    ];
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, "", messages);
    expect(prompt.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
  });

  it("computes total and cached token estimates", () => {
    const prompt = strategy.buildCachedPrompt(makeAgent(), grounding, "", []);
    expect(prompt.totalEstimatedTokens).toBeGreaterThan(0);
    expect(prompt.estimatedCachedTokens).toBeGreaterThan(0);
    expect(prompt.estimatedCachedTokens).toBeLessThanOrEqual(prompt.totalEstimatedTokens);
  });
});

describe("PromptCacheStrategy.estimateCacheSavings", () => {
  const strategy = new PromptCacheStrategy();

  it("returns zero savings when nothing is cached", () => {
    const est = strategy.estimateCacheSavings(1000, 0);
    expect(est.cachedTokens).toBe(0);
    expect(est.freshTokens).toBe(1000);
    expect(est.cacheRatio).toBe(0);
    expect(est.estimatedSavingUsd).toBe(0);
  });

  it("computes a positive saving when tokens are cached", () => {
    const est = strategy.estimateCacheSavings(1000, 800);
    expect(est.freshTokens).toBe(200);
    expect(est.cacheRatio).toBeCloseTo(0.8);
    expect(est.estimatedSavingUsd).toBeGreaterThan(0);
  });

  it("savings scale with the cache ratio", () => {
    const low = strategy.estimateCacheSavings(1000, 200);
    const high = strategy.estimateCacheSavings(1000, 900);
    expect(high.estimatedSavingUsd).toBeGreaterThan(low.estimatedSavingUsd);
  });

  it("handles a zero-token input without dividing by zero", () => {
    const est = strategy.estimateCacheSavings(0, 0);
    expect(est.cacheRatio).toBe(0);
    expect(est.estimatedSavingUsd).toBe(0);
  });

  it("never reports a negative saving", () => {
    const est = strategy.estimateCacheSavings(100, 100);
    expect(est.estimatedSavingUsd).toBeGreaterThanOrEqual(0);
  });
});
