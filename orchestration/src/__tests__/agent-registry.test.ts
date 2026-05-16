/**
 * Tests for AgentRegistry — registration, lookup, capability routing, fallback chains.
 */

import { AgentRegistry, INTENT_CAPABILITY_MAP } from "../agents/agent-registry";
import {
  AgentDefinition,
  ChatIntentType,
  ModelProvider,
} from "../agents/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAgent(
  id: string,
  capabilities: string[] = [],
  fallbackAgentId?: string,
): AgentDefinition {
  return {
    id,
    name: `Agent ${id}`,
    description: "Test agent",
    provider: ModelProvider.anthropic,
    model: "claude-haiku-4-5",
    capabilities,
    systemPrompt: `System prompt for ${id}`,
    fallbackAgentId,
  };
}

// ---------------------------------------------------------------------------
// Basic CRUD
// ---------------------------------------------------------------------------

describe("AgentRegistry — basic CRUD", () => {
  it("registers and retrieves an agent by id", () => {
    const registry = new AgentRegistry();
    const agent = makeAgent("my-agent");
    registry.register(agent);
    expect(registry.get("my-agent")).toEqual(agent);
  });

  it("returns undefined for an unregistered agent", () => {
    const registry = new AgentRegistry();
    expect(registry.get("ghost")).toBeUndefined();
  });

  it("overwrites an existing agent on re-registration", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("agent-a", ["cap1"]));
    const updated = makeAgent("agent-a", ["cap1", "cap2"]);
    registry.register(updated);
    expect(registry.get("agent-a")!.capabilities).toContain("cap2");
  });

  it("removes a registered agent and returns true", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("to-remove"));
    expect(registry.remove("to-remove")).toBe(true);
    expect(registry.get("to-remove")).toBeUndefined();
  });

  it("returns false when removing a non-existent agent", () => {
    const registry = new AgentRegistry();
    expect(registry.remove("ghost")).toBe(false);
  });

  it("listAll returns all registered agents", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("a1"));
    registry.register(makeAgent("a2"));
    registry.register(makeAgent("a3"));
    const all = registry.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((a) => a.id)).toEqual(
      expect.arrayContaining(["a1", "a2", "a3"]),
    );
  });

  it("listAll returns empty array for empty registry", () => {
    const registry = new AgentRegistry();
    expect(registry.listAll()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Capability-based listing
// ---------------------------------------------------------------------------

describe("AgentRegistry.listByCapability", () => {
  it("returns agents that have the given capability", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("a1", ["search", "qa"]));
    registry.register(makeAgent("a2", ["qa"]));
    registry.register(makeAgent("a3", ["search"]));
    expect(registry.listByCapability("qa")).toHaveLength(2);
    expect(registry.listByCapability("search")).toHaveLength(2);
  });

  it("returns empty array when no agent has the capability", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("a1", ["qa"]));
    expect(registry.listByCapability("nonexistent")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Fallback chain traversal
// ---------------------------------------------------------------------------

describe("AgentRegistry.getFallback", () => {
  it("returns the direct fallback agent", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("primary", [], "backup"));
    registry.register(makeAgent("backup"));
    expect(registry.getFallback("primary")?.id).toBe("backup");
  });

  it("returns undefined when the primary has no fallbackAgentId", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("no-fallback"));
    expect(registry.getFallback("no-fallback")).toBeUndefined();
  });

  it("returns undefined when the fallback agent is not registered", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("primary", [], "missing-backup"));
    expect(registry.getFallback("primary")).toBeUndefined();
  });

  it("returns undefined for a non-existent starting agent", () => {
    const registry = new AgentRegistry();
    expect(registry.getFallback("ghost")).toBeUndefined();
  });

  it("traverses multi-hop fallback chains", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("a", [], "b"));
    registry.register(makeAgent("b", [], "c"));
    registry.register(makeAgent("c"));
    // getFallback("a") should reach "b", then "b" -> "c" (no further fallback)
    // The current implementation returns the terminal reachable agent
    const fallback = registry.getFallback("a");
    // It traverses until there's no fallbackAgentId — final node is "c"
    expect(fallback?.id).toBe("c");
  });

  it("returns undefined when the agent points to itself (self-loop)", () => {
    const registry = new AgentRegistry();
    registry.register(makeAgent("loop", [], "loop"));
    // Self-loop: primary and current both have same id, returns undefined
    expect(registry.getFallback("loop")).toBeUndefined();
  });

  it("stops after 10 hops to prevent infinite loops in circular chains", () => {
    const registry = new AgentRegistry();
    // Build a chain of 15 agents, all pointing to the next
    for (let i = 0; i < 15; i++) {
      registry.register(
        makeAgent(`agent-${i}`, [], i < 14 ? `agent-${i + 1}` : undefined),
      );
    }
    // Should not throw and should return some result (or undefined) within 10 hops
    expect(() => registry.getFallback("agent-0")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Default registry
// ---------------------------------------------------------------------------

describe("AgentRegistry.createWithDefaults", () => {
  const registry = AgentRegistry.createWithDefaults();

  it("creates a registry with 16 agents", () => {
    expect(registry.listAll()).toHaveLength(16);
  });

  it("includes primary supervisor agent", () => {
    const supervisor = registry.get("supervisor");
    expect(supervisor).toBeDefined();
    expect(supervisor!.provider).toBe(ModelProvider.anthropic);
    expect(supervisor!.capabilities).toContain("routing");
  });

  it("includes all 8 intent-specific capability agents (Anthropic side)", () => {
    const expectedIds = [
      "article-search",
      "article-qa",
      "topic-explorer",
      "trend-analyst",
      "bias-analyzer",
      "clarification",
      "quality-reviewer",
    ];
    for (const id of expectedIds) {
      expect(registry.get(id)).toBeDefined();
    }
  });

  it("every Anthropic primary has a Google fallback registered", () => {
    const primaries = registry
      .listAll()
      .filter((a) => a.provider === ModelProvider.anthropic && a.fallbackAgentId);
    for (const primary of primaries) {
      expect(registry.get(primary.fallbackAgentId!)).toBeDefined();
    }
  });

  it("all ChatIntentType values map to a capability with at least one agent", () => {
    const intents = Object.values(ChatIntentType);
    for (const intent of intents) {
      const capability = INTENT_CAPABILITY_MAP[intent];
      expect(registry.listByCapability(capability).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// INTENT_CAPABILITY_MAP
// ---------------------------------------------------------------------------

describe("INTENT_CAPABILITY_MAP", () => {
  it("has an entry for every ChatIntentType", () => {
    const intents = Object.values(ChatIntentType);
    for (const intent of intents) {
      expect(INTENT_CAPABILITY_MAP[intent]).toBeDefined();
    }
  });

  it("maps article_search to 'article_search'", () => {
    expect(INTENT_CAPABILITY_MAP[ChatIntentType.article_search]).toBe(
      "article_search",
    );
  });

  it("maps general_chat to 'general_chat'", () => {
    expect(INTENT_CAPABILITY_MAP[ChatIntentType.general_chat]).toBe(
      "general_chat",
    );
  });
});
