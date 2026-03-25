/**
 * Conversation context manager for multi-turn chat sessions.
 *
 * Maintains message history, generates running summaries when the
 * history exceeds a configurable window, and provides token-aware
 * truncation to stay within model context limits.
 */

import { type Message } from "../agents/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ContextManagerConfig {
  /** Maximum messages to keep in the active window before summarising. */
  maxActiveMessages?: number;
  /** Approximate token budget for the message window (chars / 4). */
  maxContextTokens?: number;
  /** Session ID for correlation. */
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface SessionState {
  /** Unique session identifier. */
  sessionId: string;
  /** Running summary of older messages. */
  summary: string;
  /** Active message window (most recent turns). */
  messages: Message[];
  /** Total messages processed (including summarised). */
  totalMessages: number;
  /** ISO timestamp of session creation. */
  createdAt: string;
  /** ISO timestamp of most recent message. */
  lastActiveAt: string;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ACTIVE = 20;
const DEFAULT_MAX_TOKENS = 12_000;

export class ContextManager {
  private readonly sessions: Map<string, SessionState> = new Map();
  private readonly maxActive: number;
  private readonly maxTokens: number;

  constructor(config: ContextManagerConfig = {}) {
    this.maxActive = config.maxActiveMessages ?? DEFAULT_MAX_ACTIVE;
    this.maxTokens = config.maxContextTokens ?? DEFAULT_MAX_TOKENS;
  }

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  /** Create or retrieve an existing session. */
  getOrCreateSession(sessionId: string): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const session: SessionState = {
      sessionId,
      summary: "",
      messages: [],
      totalMessages: 0,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /** Delete a session and its history. */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /** List all active session IDs. */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  // -----------------------------------------------------------------------
  // Message management
  // -----------------------------------------------------------------------

  /** Append a message to the session, triggering summarisation if needed. */
  addMessage(sessionId: string, message: Message): SessionState {
    const session = this.getOrCreateSession(sessionId);
    session.messages.push({
      ...message,
      timestamp: message.timestamp ?? new Date().toISOString(),
    });
    session.totalMessages++;
    session.lastActiveAt = new Date().toISOString();

    // Compact if window exceeded
    if (session.messages.length > this.maxActive) {
      this.compactSession(session);
    }

    return session;
  }

  /**
   * Get the context payload suitable for passing to the LLM client.
   * Returns the running summary plus the active message window,
   * truncated to fit within the token budget.
   */
  getContext(sessionId: string): { summary: string; messages: Message[] } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { summary: "", messages: [] };
    }

    const messages = this.truncateToTokenBudget(session.messages);
    return { summary: session.summary, messages };
  }

  /** Return the running summary for a session. */
  getSummary(sessionId: string): string {
    return this.sessions.get(sessionId)?.summary ?? "";
  }

  /** Manually update the running summary (e.g. after an LLM-based summarisation call). */
  updateSummary(sessionId: string, summary: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.summary = summary;
    }
  }

  // -----------------------------------------------------------------------
  // Compaction
  // -----------------------------------------------------------------------

  /**
   * Move the oldest half of the active window into the running summary.
   * Uses a simple extractive approach (first line of each message) to
   * keep the summary compact. A production implementation would call
   * an LLM to produce an abstractive summary.
   */
  private compactSession(session: SessionState): void {
    const midpoint = Math.floor(session.messages.length / 2);
    const toSummarise = session.messages.splice(0, midpoint);

    const bullets = toSummarise.map((m) => {
      const firstLine = m.content.split("\n")[0]?.slice(0, 200) ?? "";
      return `- [${m.role}] ${firstLine}`;
    });

    const newSummaryBlock = bullets.join("\n");
    session.summary = session.summary
      ? `${session.summary}\n${newSummaryBlock}`
      : newSummaryBlock;
  }

  // -----------------------------------------------------------------------
  // Token-aware truncation
  // -----------------------------------------------------------------------

  /** Estimate tokens for a string (rough: 1 token ~ 4 chars). */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Trim messages from the front until the total token estimate fits
   * within the configured budget.
   */
  private truncateToTokenBudget(messages: Message[]): Message[] {
    let totalTokens = messages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content),
      0,
    );

    const result = [...messages];
    while (result.length > 1 && totalTokens > this.maxTokens) {
      const removed = result.shift()!;
      totalTokens -= this.estimateTokens(removed.content);
    }

    return result;
  }
}
