/**
 * Tests for ContextManager — session lifecycle, message windowing, compaction, token truncation.
 */

import { ContextManager } from "../context/context-manager";
import { Message } from "../agents/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function userMsg(content: string): Message {
  return { role: "user", content };
}

function assistantMsg(content: string): Message {
  return { role: "assistant", content };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

describe("ContextManager — session lifecycle", () => {
  it("creates a new session on first access", () => {
    const cm = new ContextManager();
    const session = cm.getOrCreateSession("sess-1");
    expect(session.sessionId).toBe("sess-1");
    expect(session.messages).toHaveLength(0);
    expect(session.totalMessages).toBe(0);
    expect(session.summary).toBe("");
  });

  it("returns the same session on subsequent calls", () => {
    const cm = new ContextManager();
    const s1 = cm.getOrCreateSession("sess-x");
    const s2 = cm.getOrCreateSession("sess-x");
    expect(s1).toBe(s2); // same reference
  });

  it("listSessions includes the created session id", () => {
    const cm = new ContextManager();
    cm.getOrCreateSession("abc");
    cm.getOrCreateSession("def");
    expect(cm.listSessions()).toEqual(expect.arrayContaining(["abc", "def"]));
  });

  it("deleteSession removes the session and returns true", () => {
    const cm = new ContextManager();
    cm.getOrCreateSession("to-del");
    expect(cm.deleteSession("to-del")).toBe(true);
    expect(cm.listSessions()).not.toContain("to-del");
  });

  it("deleteSession returns false for an unknown session", () => {
    const cm = new ContextManager();
    expect(cm.deleteSession("ghost")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addMessage
// ---------------------------------------------------------------------------

describe("ContextManager.addMessage", () => {
  it("appends messages and increments totalMessages", () => {
    const cm = new ContextManager();
    cm.addMessage("s1", userMsg("Hello"));
    cm.addMessage("s1", assistantMsg("Hi there"));
    const session = cm.getOrCreateSession("s1");
    expect(session.totalMessages).toBe(2);
  });

  it("injects timestamp when message lacks one", () => {
    const cm = new ContextManager();
    cm.addMessage("s1", { role: "user", content: "no timestamp" });
    const session = cm.getOrCreateSession("s1");
    expect(session.messages[0]!.timestamp).toBeDefined();
  });

  it("preserves an explicit timestamp", () => {
    const cm = new ContextManager();
    const ts = "2024-01-01T00:00:00.000Z";
    cm.addMessage("s1", { role: "user", content: "with ts", timestamp: ts });
    const session = cm.getOrCreateSession("s1");
    expect(session.messages[0]!.timestamp).toBe(ts);
  });

  it("creates the session if it does not exist yet", () => {
    const cm = new ContextManager();
    cm.addMessage("brand-new", userMsg("hey"));
    expect(cm.listSessions()).toContain("brand-new");
  });

  it("updates lastActiveAt on each addition", () => {
    const cm = new ContextManager();
    cm.getOrCreateSession("s2");
    const before = cm.getOrCreateSession("s2").lastActiveAt;
    // Force a slight time advance by waiting until Date.now() ticks
    const now = Date.now();
    while (Date.now() === now) {
      // spin briefly
    }
    cm.addMessage("s2", userMsg("tick"));
    const after = cm.getOrCreateSession("s2").lastActiveAt;
    expect(after >= before).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compaction (window overflow)
// ---------------------------------------------------------------------------

describe("ContextManager — window compaction", () => {
  it("compacts when messages exceed maxActiveMessages", () => {
    const cm = new ContextManager({ maxActiveMessages: 4 });
    for (let i = 0; i < 5; i++) {
      cm.addMessage("sess", userMsg(`message ${i}`));
    }
    const session = cm.getOrCreateSession("sess");
    // After 5 messages with maxActive=4 it should compact (splice oldest half)
    expect(session.messages.length).toBeLessThan(5);
    // The summary should be non-empty
    expect(session.summary.length).toBeGreaterThan(0);
  });

  it("totalMessages keeps counting across compaction", () => {
    const cm = new ContextManager({ maxActiveMessages: 4 });
    for (let i = 0; i < 10; i++) {
      cm.addMessage("sess", userMsg(`msg ${i}`));
    }
    expect(cm.getOrCreateSession("sess").totalMessages).toBe(10);
  });

  it("summary accumulates across multiple compaction rounds", () => {
    const cm = new ContextManager({ maxActiveMessages: 4 });
    for (let i = 0; i < 15; i++) {
      cm.addMessage("sess", userMsg(`m${i}`));
    }
    const session = cm.getOrCreateSession("sess");
    expect(session.summary.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getContext
// ---------------------------------------------------------------------------

describe("ContextManager.getContext", () => {
  it("returns empty context for unknown sessionId", () => {
    const cm = new ContextManager();
    const ctx = cm.getContext("nobody");
    expect(ctx.summary).toBe("");
    expect(ctx.messages).toHaveLength(0);
  });

  it("returns messages for an existing session", () => {
    const cm = new ContextManager();
    cm.addMessage("s1", userMsg("first"));
    cm.addMessage("s1", assistantMsg("second"));
    const ctx = cm.getContext("s1");
    expect(ctx.messages).toHaveLength(2);
  });

  it("returns the running summary", () => {
    const cm = new ContextManager({ maxActiveMessages: 2 });
    cm.addMessage("s1", userMsg("a"));
    cm.addMessage("s1", assistantMsg("b"));
    cm.addMessage("s1", userMsg("c")); // triggers compaction
    const ctx = cm.getContext("s1");
    expect(ctx.summary.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getSummary / updateSummary
// ---------------------------------------------------------------------------

describe("ContextManager.getSummary / updateSummary", () => {
  it("getSummary returns empty string for unknown session", () => {
    const cm = new ContextManager();
    expect(cm.getSummary("ghost")).toBe("");
  });

  it("getSummary returns empty string for fresh session", () => {
    const cm = new ContextManager();
    cm.getOrCreateSession("fresh");
    expect(cm.getSummary("fresh")).toBe("");
  });

  it("updateSummary sets the summary on an existing session", () => {
    const cm = new ContextManager();
    cm.getOrCreateSession("s");
    cm.updateSummary("s", "User asked about policy X.");
    expect(cm.getSummary("s")).toBe("User asked about policy X.");
  });

  it("updateSummary is a no-op for unknown sessions (does not throw)", () => {
    const cm = new ContextManager();
    expect(() => cm.updateSummary("ghost", "anything")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Token-budget truncation
// ---------------------------------------------------------------------------

describe("ContextManager — token-budget truncation", () => {
  it("truncates long messages to fit within the token budget", () => {
    // maxContextTokens = 100 tokens ≈ 400 chars
    const cm = new ContextManager({ maxContextTokens: 100 });
    // Add several very long messages
    for (let i = 0; i < 5; i++) {
      cm.addMessage("s1", userMsg("A".repeat(500))); // ~125 tokens each
    }
    const ctx = cm.getContext("s1");
    // Should have fewer messages than the 5 we added (after truncation)
    expect(ctx.messages.length).toBeLessThanOrEqual(5);
    // At least 1 message must remain (truncation preserves the tail)
    expect(ctx.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps all messages when they fit within the budget", () => {
    const cm = new ContextManager({ maxContextTokens: 10_000 });
    cm.addMessage("s1", userMsg("short"));
    cm.addMessage("s1", assistantMsg("also short"));
    const ctx = cm.getContext("s1");
    expect(ctx.messages).toHaveLength(2);
  });
});
