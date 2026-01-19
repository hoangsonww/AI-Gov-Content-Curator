import React, { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Head from "next/head";
import { Send } from "lucide-react";

type Citation = {
  number: number;
  id: string;
  title: string;
  source: string;
  url: string;
  fetchedAt: string;
  score: number;
};

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  time?: string;
  citations?: Citation[];
  warnings?: string[];
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const MessageContent = memo(({ message }: { message: Message }) => {
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null);

  const linkifyCitations = (text: string) =>
    text.replace(/\[Source (\d+(?:,\s*\d+)*)\]/gi, (match, nums) => {
      const ids = nums
        .split(",")
        .map((num: string) => num.trim())
        .filter(Boolean);
      if (!ids.length) return match;
      return ids
        .map(
          (num: string) => `[[Source ${num}]](#citation-${message.id}-${num})`,
        )
        .join(", ");
    });

  const markdown = linkifyCitations(message.text).replace(/\r?\n/g, "  \n");

  return (
    <div className="msg-content">
      <div className="msg-text">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
              const href = props.href ?? "";
              const children = props.children;
              const isCitation =
                typeof href === "string" && href.startsWith("#citation-");
              if (isCitation) {
                const citationId = href.slice(1);
                const match = href.match(/-(\d+)$/);
                const citationNum = match ? Number(match[1]) : null;
                return (
                  <a
                    href={href}
                    className="citation-link"
                    onMouseEnter={() => {
                      if (citationNum) setHoveredCitation(citationNum);
                    }}
                    onMouseLeave={() => setHoveredCitation(null)}
                    onClick={(e) => {
                      e.preventDefault();
                      const citationEl = document.getElementById(citationId);
                      if (citationEl) {
                        citationEl.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        });
                        citationEl.classList.add("highlight-citation");
                        setTimeout(
                          () =>
                            citationEl.classList.remove("highlight-citation"),
                          2000,
                        );
                      }
                    }}
                  >
                    {children}
                  </a>
                );
              }

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="message-link"
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {message.warnings && message.warnings.length > 0 && (
        <div className="msg-warning">
          <span className="warn-icon">⚠️</span>
          <span className="warn-text">
            Quality check detected potential issues. Please verify
            independently.
          </span>
        </div>
      )}

      {message.citations && message.citations.length > 0 && (
        <>
          <div className="msg-divider" />
          <div className="msg-sources">
            <div className="sources-title">SOURCES</div>
            {message.citations.map((citation) => (
              <div
                key={citation.number}
                id={`citation-${message.id}-${citation.number}`}
                className={`source-item ${hoveredCitation === citation.number ? "source-hovered" : ""}`}
              >
                <span className="source-num">[{citation.number}]</span>
                <div className="source-body">
                  <div className="source-top">
                    <span className="source-title">{citation.title}</span>
                    <span className="source-score">
                      {Math.round(citation.score * 100)}%
                    </span>
                  </div>
                  <div className="source-bottom">
                    <span className="source-domain">
                      {(() => {
                        try {
                          return new URL(
                            citation.url || citation.source,
                          ).hostname.replace("www.", "");
                        } catch {
                          return citation.source;
                        }
                      })()}
                    </span>
                    {citation.url && (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="msg-time">{message.time}</div>
    </div>
  );
});

MessageContent.displayName = "MessageContent";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState("");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("chat-conversations");
    const storedActiveId = localStorage.getItem("chat-active-id");

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) {
          setConversations(parsed);
          if (
            storedActiveId &&
            parsed.find((c: Conversation) => c.id === storedActiveId)
          ) {
            setActiveConvId(storedActiveId);
          } else {
            setActiveConvId(parsed[0].id);
          }
        }
      } catch (e) {
        // If parsing fails, start with empty
        setConversations([]);
        setActiveConvId("");
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("chat-conversations", JSON.stringify(conversations));
    } else {
      localStorage.removeItem("chat-conversations");
    }
  }, [conversations]);

  // Save active conversation ID
  useEffect(() => {
    if (activeConvId) {
      localStorage.setItem("chat-active-id", activeConvId);
    } else {
      localStorage.removeItem("chat-active-id");
    }
  }, [activeConvId]);

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        240,
        textareaRef.current.scrollHeight,
      )}px`;
    }
  }, [input]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;

    const msg: Message = {
      id: `m-${Date.now()}`,
      role: "user",
      text,
      time: nowTime(),
    };

    let currentConvId = activeConvId;
    let historyMessages: Message[] = [];

    // If no conversations exist, create one
    if (conversations.length === 0) {
      const newConvId = `c-${Date.now()}`;
      const welcomeMsg: Message = {
        id: `m-welcome-${Date.now()}`,
        role: "ai",
        text: "Hello! I'm ArticleIQ, your AI assistant for exploring government and news articles. Ask me anything about the articles in our database, and I'll search through them to provide you with relevant information.",
        time: nowTime(),
      };
      const newConv: Conversation = {
        id: newConvId,
        title: "New Chat",
        messages: [welcomeMsg, msg],
      };
      setConversations([newConv]);
      setActiveConvId(newConvId);
      currentConvId = newConvId;
      historyMessages = [welcomeMsg];
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId ? { ...c, messages: [...c.messages, msg] } : c,
        ),
      );
      const currentConversation = conversations.find(
        (c) => c.id === activeConvId,
      );
      historyMessages = currentConversation?.messages || [];
    }

    setInput("");
    setIsTyping(true);

    try {
      // Get conversation history for context (last 10 messages)
      // Gemini requires the first turn to be from the user, so trim leading assistant messages (e.g., welcome message)
      const mappedHistory = historyMessages.slice(-10).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        text: m.text,
      }));
      const firstUserIdx = mappedHistory.findIndex((m) => m.role === "user");
      const history =
        firstUserIdx === -1 ? [] : mappedHistory.slice(firstUserIdx);

      // Call backend streaming API
      const API_URL = (
        process.env.NEXT_PUBLIC_API_URL ||
        "https://ai-content-curator-backend.vercel.app"
      ).replace(/\/$/, "");
      const response = await fetch(`${API_URL}/api/chat/sitewide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          userMessage: text,
          history: history,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Create a placeholder message immediately for streaming
      const aiMsgId = `m-ai-${Date.now()}`;
      let streamedText = "";
      let citations: Citation[] = [];
      let warnings: string[] = [];

      // Create the message bubble immediately
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: aiMsgId,
                    role: "ai" as const,
                    text: "",
                    time: nowTime(),
                    citations: [],
                    warnings: [],
                  },
                ],
              }
            : c,
        ),
      );
      setIsTyping(false);

      // Handle Server-Sent Events stream (robust multi-line parser)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let buffer = "";
      let currentEvent = "";
      let dataLines: string[] = [];

      const flushEvent = () => {
        if (dataLines.length === 0) return;
        const payload = dataLines.join("\n").trim();
        dataLines = [];
        if (!payload) return;

        try {
          const data = JSON.parse(payload);

          if (data.sources) {
            citations = data.sources;
            console.log("Received citations:", citations.length);
          }

          if (data.warnings) {
            warnings = data.warnings;
            console.log("Received warnings:", warnings);
          }

          if (typeof data.text === "string" || currentEvent === "chunk") {
            if (typeof data.text === "string") {
              streamedText += data.text;
            }

            setConversations((prevConvs) => {
              const targetConv = prevConvs.find((c) => c.id === currentConvId);
              if (!targetConv) {
                console.error(
                  "Conversation not found for ID:",
                  currentConvId,
                  "Available:",
                  prevConvs.map((c) => c.id),
                );
                return prevConvs;
              }

              const newConvs = prevConvs.map((c) => {
                if (c.id !== currentConvId) return c;

                const aiMsgExists = c.messages.some((m) => m.id === aiMsgId);

                if (aiMsgExists) {
                  return {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            text: streamedText,
                            citations: [...citations],
                            warnings: [...warnings],
                          }
                        : m,
                    ),
                  };
                }

                return {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: aiMsgId,
                      role: "ai" as const,
                      text: streamedText,
                      time: nowTime(),
                      citations: [...citations],
                      warnings: [...warnings],
                    },
                  ],
                };
              });
              return [...newConvs];
            });
          } else if (currentEvent === "error" && data.message) {
            console.error("Streaming error:", data);
            if (streamedText.trim().length === 0) {
              streamedText =
                data.message || "An error occurred. Please try again.";
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === currentConvId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === aiMsgId ? { ...m, text: streamedText } : m,
                        ),
                      }
                    : c,
                ),
              );
            } else {
              // Preserve partial response and surface the error as a warning
              warnings = [...warnings, data.message];
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === currentConvId
                    ? {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === aiMsgId
                            ? {
                                ...m,
                                text: streamedText,
                                citations: [...citations],
                                warnings: [...warnings],
                              }
                            : m,
                        ),
                      }
                    : c,
                ),
              );
            }
          }
        } catch (err) {
          console.error("Failed to parse SSE payload", {
            currentEvent,
            payload,
            err,
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trimEnd();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith("event:")) {
            flushEvent();
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          } else if (line === "") {
            flushEvent();
            currentEvent = "";
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      flushEvent();

      // Final update with all citations and warnings
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsgId
                    ? {
                        ...m,
                        text:
                          streamedText ||
                          "Sorry, I couldn't generate a response. Please try again.",
                        citations,
                        warnings,
                      }
                    : m,
                ),
              }
            : c,
        ),
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setIsTyping(false);

      // Add error message
      const errorMsg: Message = {
        id: `m-ai-${Date.now()}`,
        role: "ai",
        text: "Sorry, there was an error processing your request. Please check your connection and try again.",
        time: nowTime(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, messages: [...c.messages, errorMsg] }
            : c,
        ),
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function createNewConversation() {
    const id = `c-${Date.now()}`;
    const welcomeMsg: Message = {
      id: `m-welcome-${Date.now()}`,
      role: "ai",
      text: "Hello! I'm ArticleIQ, your AI assistant for exploring government and news articles. Ask me anything about the articles in our database, and I'll search through them to provide you with relevant information.",
      time: nowTime(),
    };
    const conv: Conversation = {
      id,
      title: "New Chat",
      messages: [welcomeMsg],
    };
    setConversations([conv, ...conversations]);
    setActiveConvId(id);
  }

  function openRenameModal(conv: Conversation) {
    setRenameConvId(conv.id);
    setRenameValue(conv.title);
    setRenameModalOpen(true);
  }

  function handleRename() {
    if (renameValue.trim()) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === renameConvId ? { ...c, title: renameValue.trim() } : c,
        ),
      );
      setRenameModalOpen(false);
      setRenameValue("");
      setRenameConvId("");
    }
  }

  function deleteConversation(convId: string) {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== convId);

      // If we deleted the active conversation, switch to another one
      if (convId === activeConvId) {
        if (filtered.length > 0) {
          setActiveConvId(filtered[0].id);
        } else {
          // No conversations left, clear everything
          setActiveConvId("");
          return [];
        }
      }

      return filtered;
    });
    setDeleteConfirmId(null);
  }

  function clearConversation(convId: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, messages: [] } : c)),
    );
  }

  return (
    <>
      <Head>
        <title>SynthoraAI - ArticleIQ Chat</title>
        <meta name="description" content="Chat with ArticleIQ AI assistant" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="chat-root">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="brand">Conversations</div>
            <button className="btn-new" onClick={createNewConversation}>
              +
            </button>
          </div>

          <div className="conversation-list">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conv-item ${conv.id === activeConvId ? "active" : ""}`}
                onClick={() => setActiveConvId(conv.id)}
              >
                <span className="conv-title">{conv.title}</span>
                <div className="conv-actions">
                  <button
                    className="conv-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameModal(conv);
                    }}
                    title="Rename"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    className="conv-action-btn conv-action-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(conv.id);
                    }}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Main */}
        <main className="chat-main">
          <div className="messages-container">
            {conversations.length === 0 && (
              <div className="empty-state-main">
                <div className="empty-icon">💬</div>
                <h2 className="empty-title">Welcome to ArticleIQ</h2>
                <p className="empty-desc">
                  Send a message below to start your first conversation
                </p>
              </div>
            )}

            {conversations.length > 0 &&
              activeConversation?.messages.length === 0 &&
              !isTyping && (
                <div className="empty-state">Start the conversation</div>
              )}

            {activeConversation?.messages.map((m) => (
              <div key={m.id} className={`message-row ${m.role}`}>
                <div className={`message-bubble ${m.role}`}>
                  <MessageContent message={m} />
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="message-row ai">
                <div className="typing-bubble">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <textarea
              ref={textareaRef}
              className="composer-input"
              placeholder="Your message here...."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className="btn-send"
              type="submit"
              aria-label="Send message"
            >
              <Send className="send-icon" size={18} strokeWidth={2.4} />
            </button>
          </form>
        </main>

        {/* Rename Modal */}
        {renameModalOpen && (
          <div
            className="modal-overlay"
            onClick={() => setRenameModalOpen(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Rename Conversation</h3>
                <button
                  className="modal-close"
                  onClick={() => setRenameModalOpen(false)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="modal-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenameModalOpen(false);
                  }}
                  autoFocus
                  placeholder="Enter conversation name"
                />
              </div>
              <div className="modal-footer">
                <button
                  className="modal-btn modal-btn-cancel"
                  onClick={() => setRenameModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn modal-btn-primary"
                  onClick={handleRename}
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div
            className="modal-overlay"
            onClick={() => setDeleteConfirmId(null)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Delete Conversation</h3>
                <button
                  className="modal-close"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-text">
                  Are you sure you want to delete this conversation? This action
                  cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="modal-btn modal-btn-cancel"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn modal-btn-danger"
                  onClick={() => deleteConversation(deleteConfirmId)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .chat-root {
            --chat-bg: var(--bg-color);
            --chat-text: var(--text-color);
            --chat-surface: var(--card-bg);
            --chat-surface-strong: #ffffff;
            --chat-surface-alt: var(--hover-bg);
            --chat-border: var(--card-border);
            --chat-border-subtle: rgba(15, 23, 42, 0.08);
            --chat-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
            --chat-shadow-strong: 0 8px 20px rgba(15, 23, 42, 0.2);
            --chat-muted: var(--loading-text);
            --chat-muted-strong: var(--no-result-text);
            --chat-accent: var(--accent-color);
            --chat-accent-strong: #2563eb;
            --chat-accent-soft: rgba(59, 130, 246, 0.3);
            --chat-accent-soft-bg: rgba(59, 130, 246, 0.08);
            --chat-accent-soft-border: rgba(59, 130, 246, 0.25);
            --chat-warning: #fbbf24;
            --chat-warning-text: #4a3b00;
            --chat-warning-bg: rgba(251, 191, 36, 0.12);
            --chat-danger: #ef4444;
            --chat-danger-strong: #dc2626;
            --chat-overlay: rgba(15, 23, 42, 0.45);
            --chat-input-bg: var(--bg-color);
            --chat-code-bg: rgba(15, 23, 42, 0.08);
            --chat-pre-bg: rgba(15, 23, 42, 0.08);
            --chat-pre-text: var(--text-color);
            --chat-user-text: #ffffff;
            --chat-source-bg: rgba(15, 23, 42, 0.03);
            --chat-source-border: rgba(15, 23, 42, 0.08);
            --chat-modal-bg: #ffffff;
            --chat-modal-divider: rgba(15, 23, 42, 0.1);
            display: grid;
            grid-template-columns: 300px 1fr;
            height: calc(
              100vh - var(--navbar-height, 0px) - var(--footer-height, 0px)
            );
            max-height: calc(
              100vh - var(--navbar-height, 0px) - var(--footer-height, 0px)
            );
            min-height: 0;
            background: var(--chat-bg);
            color: var(--chat-text);
            gap: 20px;
            padding: 20px;
            box-sizing: border-box;
            font-family: "Inter", sans-serif;
            animation: chatFadeIn 0.45s ease-out both;
          }

          :global([data-theme="dark"]) .chat-root {
            --chat-bg: #0f0f0f;
            --chat-text: #ffffff;
            --chat-surface: #1b1b1b;
            --chat-surface-strong: #161616;
            --chat-surface-alt: #2a2a2a;
            --chat-border: #2c2c2c;
            --chat-border-subtle: rgba(255, 255, 255, 0.08);
            --chat-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
            --chat-shadow-strong: 0 8px 20px rgba(0, 0, 0, 0.5);
            --chat-muted: #9ca3af;
            --chat-muted-strong: #6b7280;
            --chat-accent: #3b82f6;
            --chat-accent-strong: #2563eb;
            --chat-accent-soft: rgba(59, 130, 246, 0.3);
            --chat-accent-soft-bg: rgba(59, 130, 246, 0.08);
            --chat-accent-soft-border: rgba(59, 130, 246, 0.25);
            --chat-overlay: rgba(0, 0, 0, 0.7);
            --chat-input-bg: #121212;
            --chat-code-bg: rgba(15, 15, 15, 0.7);
            --chat-pre-bg: #0f0f0f;
            --chat-pre-text: #e5e7eb;
            --chat-source-bg: rgba(255, 255, 255, 0.03);
            --chat-source-border: rgba(255, 255, 255, 0.08);
            --chat-modal-bg: #1f1f1f;
            --chat-modal-divider: rgba(255, 255, 255, 0.1);
            --chat-warning-text: #fbbf24;
          }

          :global(main) {
            padding: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            min-height: 0;
          }

          /* Sidebar */
          .sidebar {
            background: var(--chat-surface);
            border-radius: 24px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            box-shadow: var(--chat-shadow-strong);
            min-height: 0;
            animation: chatPanelIn 0.55s ease-out both;
            animation-delay: 0.05s;
          }

          .sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .brand {
            font-weight: 700;
            font-size: 1.3rem;
          }

          .btn-new {
            background: linear-gradient(
              135deg,
              var(--chat-accent),
              var(--chat-accent-strong)
            );
            color: var(--chat-user-text);
            padding: 6px 14px;
            border-radius: 9999px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 18px;
            box-shadow: var(--chat-shadow);
            transition: all 0.2s ease-in-out;
          }
          .btn-new:hover {
            transform: translateY(-2px);
            box-shadow: var(--chat-shadow-strong);
          }

          .conversation-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .conv-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-radius: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .conv-item:hover {
            background: var(--chat-surface-alt);
            transform: translateX(2px);
          }
          .conv-item.active {
            background: linear-gradient(
              90deg,
              var(--chat-accent),
              var(--chat-accent-strong)
            );
            color: var(--chat-user-text);
            box-shadow: var(--chat-shadow-strong);
          }

          .conv-title {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .conv-actions {
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s;
            flex-shrink: 0;
          }

          .conv-item:hover .conv-actions {
            opacity: 1;
          }

          .conv-action-btn {
            background: transparent;
            border: none;
            color: var(--chat-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .conv-action-btn:hover {
            background: var(--chat-surface-alt);
            color: var(--chat-text);
          }

          .conv-action-delete:hover {
            background: rgba(239, 68, 68, 0.2);
            color: var(--chat-danger);
          }

          /* Chat main */
          .chat-main {
            display: flex;
            flex-direction: column;
            background: var(--chat-surface-strong);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: var(--chat-shadow-strong);
            min-height: 0;
            animation: chatPanelIn 0.55s ease-out both;
            animation-delay: 0.12s;
          }

          .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-height: 0;
          }

          .empty-state {
            text-align: center;
            color: var(--chat-muted);
            padding: 32px;
            font-size: 14px;
          }

          .empty-state-main {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 48px 24px;
            text-align: center;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.6;
          }

          .empty-title {
            font-size: 28px;
            font-weight: 700;
            color: var(--chat-text);
            margin: 0 0 12px 0;
          }

          .empty-desc {
            font-size: 16px;
            color: var(--chat-muted);
            margin: 0;
            max-width: 400px;
          }

          .message-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }
          .message-row.user {
            justify-content: flex-end;
          }
          .message-row.ai {
            justify-content: flex-start;
          }

          .message-bubble {
            padding: 14px 20px;
            border-radius: 22px;
            max-width: 65%;
            word-break: break-word;
            font-size: 14px;
            line-height: 1.4;
            box-shadow: var(--chat-shadow);
            transition: transform 0.1s;
          }
          .message-bubble.user {
            background: linear-gradient(
              90deg,
              var(--chat-accent),
              var(--chat-accent-strong)
            );
            color: var(--chat-user-text);
          }
          .message-bubble.ai {
            background: var(--chat-surface-alt);
            color: var(--chat-text);
          }

          .message-bubble:hover {
            transform: translateY(-1px);
          }

          :global(.msg-content) {
            width: 100%;
          }

          :global(.msg-text) {
            line-height: 1.6;
            margin-bottom: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }

          :global(.msg-text p) {
            margin: 0 0 12px 0;
          }

          :global(.msg-text p:last-child) {
            margin-bottom: 0;
          }

          :global(.msg-text strong) {
            font-weight: 700;
          }

          :global(.msg-text em) {
            font-style: italic;
          }

          :global(.msg-text a.citation-link) {
            color: var(--chat-accent);
            font-weight: 700;
            margin: 0 2px;
            text-decoration: none;
            transition: color 0.15s;
          }

          :global(.msg-text a.citation-link:hover) {
            color: var(--chat-accent-strong);
            text-decoration: underline;
          }

          :global(.msg-text a.message-link) {
            color: var(--chat-accent);
            text-decoration: underline;
          }

          :global(.msg-text ul),
          :global(.msg-text ol) {
            margin: 0 0 12px 20px;
          }

          :global(.msg-text li) {
            margin: 4px 0;
          }

          :global(.msg-text code) {
            background: var(--chat-code-bg);
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 0.9em;
          }

          :global(.msg-text pre) {
            background: var(--chat-pre-bg);
            color: var(--chat-pre-text);
            padding: 12px;
            border-radius: 10px;
            overflow-x: auto;
          }

          :global(.msg-text pre code) {
            background: transparent;
            padding: 0;
          }

          :global(.msg-warning) {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: var(--chat-warning-bg);
            border-left: 3px solid var(--chat-warning);
            border-radius: 4px;
            margin: 16px 0;
          }

          :global(.warn-icon) {
            font-size: 16px;
            flex-shrink: 0;
          }

          :global(.warn-text) {
            font-size: 12px;
            color: var(--chat-warning-text);
            line-height: 1.4;
          }

          :global(.msg-divider) {
            width: 100%;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              var(--chat-accent-soft) 20%,
              var(--chat-accent-soft) 80%,
              transparent
            );
            margin: 20px 0 16px 0;
          }

          :global(.msg-sources) {
            margin-top: 12px;
          }

          :global(.sources-title) {
            font-size: 10px;
            font-weight: 700;
            color: var(--chat-muted-strong);
            letter-spacing: 1px;
            margin-bottom: 12px;
          }

          :global(.source-item) {
            display: flex;
            gap: 12px;
            padding: 12px;
            background: var(--chat-source-bg);
            border: 1px solid var(--chat-source-border);
            border-radius: 8px;
            margin-bottom: 8px;
            transition: all 0.2s;
          }

          :global(.source-item:hover),
          :global(.source-item.source-hovered),
          :global(.source-item.highlight-citation) {
            background: var(--chat-accent-soft-bg);
            border-color: var(--chat-accent-soft-border);
          }

          :global(.source-num) {
            color: var(--chat-accent);
            font-weight: 700;
            font-size: 12px;
            flex-shrink: 0;
            line-height: 1.4;
          }

          :global(.source-body) {
            flex: 1;
            min-width: 0;
          }

          :global(.source-top) {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 8px;
          }

          :global(.source-title) {
            flex: 1;
            font-size: 13px;
            font-weight: 500;
            color: var(--chat-text);
            line-height: 1.4;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          :global(.source-score) {
            font-size: 11px;
            font-weight: 700;
            color: var(--chat-accent);
            flex-shrink: 0;
          }

          :global(.source-bottom) {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          :global(.source-domain) {
            font-size: 11px;
            color: var(--chat-muted);
          }

          :global(.source-link) {
            font-size: 11px;
            font-weight: 600;
            color: var(--chat-accent);
            text-decoration: none;
            transition: color 0.15s;
          }

          :global(.source-link:hover) {
            color: var(--chat-accent-strong);
          }

          :global(.msg-time) {
            font-size: 10px;
            color: var(--chat-muted-strong);
            margin-top: 12px;
            text-align: right;
          }

          .message-row.user :global(.msg-time) {
            color: var(--chat-user-text);
          }

          .message-time {
            font-size: 10px;
            color: var(--chat-muted-strong);
            margin-top: 12px;
            text-align: right;
          }

          .typing-bubble {
            display: flex;
            gap: 4px;
            background: var(--chat-surface-alt);
            padding: 8px 14px;
            border-radius: 20px;
            color: var(--chat-accent);
            font-weight: bold;
            animation: pulse 1s infinite;
          }

          @keyframes chatFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes chatPanelIn {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pulse {
            0%,
            100% {
              opacity: 0.5;
            }
            50% {
              opacity: 1;
            }
          }

          /* Composer */
          .composer {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: center;
            padding: 18px 24px;
            border-top: 1px solid var(--chat-border);
            gap: 12px;
          }

          .composer-input {
            flex: 1;
            border: none;
            border-radius: 22px;
            padding: 14px 18px;
            background: var(--chat-input-bg);
            color: var(--chat-text);
            resize: none;
            font-size: 14px;
            font-family: "Inter", sans-serif;
            outline: none;
            transition: box-shadow 0.2s ease-in-out;
          }

          .composer-input:focus {
            box-shadow: 0 0 0 2px var(--chat-accent);
          }

          .btn-send {
            background: linear-gradient(
              90deg,
              var(--chat-accent),
              var(--chat-accent-strong)
            );
            border: none;
            border-radius: 22px;
            height: 44px;
            width: 44px;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            box-shadow: var(--chat-shadow);
            gap: 0;
            font-weight: 700;
            font-size: 13px;
          }
          .btn-send:hover {
            transform: translateY(-2px);
            box-shadow: var(--chat-shadow-strong);
          }

          .send-icon {
            width: 18px;
            height: 18px;
            display: block;
            color: var(--chat-user-text);
          }

          @media (max-width: 900px) {
            .chat-root {
              grid-template-columns: 1fr;
              grid-template-rows: auto minmax(0, 1fr);
              height: calc(
                100dvh - var(--navbar-height, 0px) - var(--footer-height, 0px)
              );
              max-height: calc(
                100dvh - var(--navbar-height, 0px) - var(--footer-height, 0px)
              );
              gap: 12px;
              padding: 12px;
            }

            .sidebar {
              max-height: 38vh;
              padding: 16px;
              border-radius: 20px;
            }

            .conversation-list {
              gap: 8px;
            }

            .chat-main {
              border-radius: 20px;
            }

            .messages-container {
              padding: 18px;
            }

            .message-bubble {
              max-width: 92%;
            }
          }

          @media (max-width: 600px) {
            .chat-root {
              padding: 10px;
              gap: 10px;
            }

            .sidebar {
              padding: 12px;
              border-radius: 16px;
              max-height: 40vh;
            }

            .brand {
              font-size: 1.1rem;
            }

            .btn-new {
              font-size: 16px;
              padding: 4px 12px;
            }

            .messages-container {
              padding: 14px;
              gap: 12px;
            }

            .message-bubble {
              padding: 12px 14px;
              font-size: 13px;
              max-width: 100%;
            }

            .composer {
              padding: 12px;
              gap: 10px;
            }

            .composer-input {
              padding: 12px 14px;
              font-size: 13px;
            }

            .btn-send {
              height: 40px;
              width: 40px;
            }

            .empty-icon {
              font-size: 48px;
            }

            .empty-title {
              font-size: 22px;
            }

            .empty-desc {
              font-size: 14px;
            }

            :global(.source-item) {
              flex-direction: column;
            }

            :global(.source-top) {
              flex-direction: column;
              align-items: flex-start;
              gap: 6px;
            }

            :global(.source-bottom) {
              flex-direction: column;
              align-items: flex-start;
              gap: 6px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .chat-root,
            .sidebar,
            .chat-main {
              animation: none;
            }
          }

          /* Modal Styles */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--chat-overlay);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.15s ease;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          .modal-content {
            background: var(--chat-modal-bg);
            border-radius: 12px;
            width: 90%;
            max-width: 450px;
            box-shadow: var(--chat-shadow-strong);
            animation: slideUp 0.2s ease;
            border: 1px solid var(--chat-accent-soft-border);
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid var(--chat-modal-divider);
          }

          .modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--chat-text);
          }

          .modal-close {
            background: transparent;
            border: none;
            color: var(--chat-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .modal-close:hover {
            background: var(--chat-surface-alt);
            color: var(--chat-text);
          }

          .modal-body {
            padding: 24px;
          }

          .modal-input {
            width: 100%;
            background: var(--chat-input-bg);
            border: 1px solid var(--chat-border);
            border-radius: 8px;
            padding: 12px 16px;
            color: var(--chat-text);
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
          }

          .modal-input:focus {
            border-color: var(--chat-accent);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          .modal-text {
            margin: 0;
            color: var(--chat-muted);
            font-size: 14px;
            line-height: 1.6;
          }

          .modal-footer {
            display: flex;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid var(--chat-modal-divider);
            justify-content: flex-end;
          }

          .modal-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
          }

          .modal-btn-cancel {
            background: transparent;
            color: var(--chat-muted);
            border: 1px solid var(--chat-border);
          }

          .modal-btn-cancel:hover {
            background: var(--chat-surface-alt);
            color: var(--chat-text);
          }

          .modal-btn-primary {
            background: linear-gradient(
              135deg,
              var(--chat-accent),
              var(--chat-accent-strong)
            );
            color: var(--chat-user-text);
          }

          .modal-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          }

          .modal-btn-danger {
            background: var(--chat-danger);
            color: var(--chat-user-text);
          }

          .modal-btn-danger:hover {
            background: var(--chat-danger-strong);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          }
        `}</style>
      </div>
    </>
  );
}
