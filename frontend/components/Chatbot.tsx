import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  AiOutlineClose,
  AiOutlineSend,
  AiOutlineLoading3Quarters,
  AiOutlineDelete,
} from "react-icons/ai";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Article } from "../pages/home";

type ChatMessage = { sender: "user" | "model"; text: string };

export default function Chatbot({ article }: { article: Article }) {
  const EDGE = 18;
  const POS_KEY = "chatbot-pos";
  const CLICK_THRESHOLD = 5; // max pixels to count as click

  // ─── 1) Lazy-load initial messages from storage ───
  const storageKey = `chat-history-${article._id}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  // ─── 2) Skip persisting that very first load ───
  const skipFirstPersist = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // ─── The rest is unchanged ───
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("Thinking…");

  const dragRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: EDGE, y: 200 });

  // Loader text switch
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (loading) {
      setLoaderText("Thinking…");
      t = setTimeout(() => setLoaderText("Generating response…"), 3000);
    }
    return () => clearTimeout(t);
  }, [loading]);

  // Snap helper
  const snap = useCallback(
    (raw: { x: number; y: number }) => {
      const w = window.innerWidth;
      const btn = dragRef.current!;
      const { width, height } = btn.getBoundingClientRect();
      const x = raw.x + width / 2 < w / 2 ? EDGE : w - width - EDGE;
      const y = Math.min(
        Math.max(raw.y, EDGE),
        window.innerHeight - height - EDGE,
      );
      const final = { x, y };
      setPos(final);
      localStorage.setItem(POS_KEY, JSON.stringify(final));
    },
    [EDGE],
  );

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startPointer.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // click vs drag
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    const distSq = dx * dx + dy * dy;

    snap(pos);
    if (distSq < CLICK_THRESHOLD * CLICK_THRESHOLD) {
      setOpen(true);
    }
  };

  // Load saved button position
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      try {
        setPos(JSON.parse(raw));
      } catch {}
    }
  }, []);

  // re-snap on resize
  useEffect(() => {
    const onResize = () => snap(pos);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, snap]);

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // auto-scroll
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput("");
    setMessages((m) => [...m, { sender: "user", text: txt }]);
    setLoading(true);

    try {
      const res = await fetch(
        "https://ai-content-curator-backend.vercel.app/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ article, userMessage: txt }),
        },
      );
      const { reply } = await res.json();
      setMessages((m) => [...m, { sender: "model", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { sender: "model", text: "⚠️ Unable to reach chat service." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // portal for modal
  const [portal, setPortal] = useState<Element | null>(null);
  useEffect(() => {
    let el = document.getElementById("chatbot-portal");
    if (!el) {
      el = document.createElement("div");
      el.id = "chatbot-portal";
      document.body.appendChild(el);
    }
    setPortal(el);
  }, []);

  return (
    <>
      <div
        ref={dragRef}
        className="cb-toggle"
        style={{
          left: pos.x,
          top: pos.y,
          touchAction: "none",
          userSelect: "none",
          position: "fixed",
          zIndex: 1000,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <IoChatbubbleEllipsesOutline size={26} />
      </div>

      {portal &&
        ReactDOM.createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="cb-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              >
                <motion.div
                  className="cb-modal"
                  initial={{ y: 70, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 70, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <header className="cb-header">
                    <span>Chat with ArticleIQ 🧠</span>
                    <div className="cb-header-btns">
                      <button
                        title="Clear conversation"
                        onClick={clearMessages}
                        className="cb-icon-btn"
                      >
                        <AiOutlineDelete size={18} />
                      </button>
                      <button
                        title="Close"
                        onClick={() => setOpen(false)}
                        className="cb-icon-btn"
                      >
                        <AiOutlineClose size={20} />
                      </button>
                    </div>
                  </header>

                  <div className="cb-body" ref={bodyRef}>
                    {messages.length === 0 && !loading ? (
                      <div className="cb-placeholder">
                        <strong>Welcome to ArticleIQ! 📰</strong>
                        <p>Start by asking a question about this article.</p>
                      </div>
                    ) : (
                      <>
                        {messages.map((m, i) => (
                          <motion.div
                            key={i}
                            className={`cb-bubble ${m.sender}`}
                            initial={{
                              opacity: 0,
                              x: m.sender === "user" ? 60 : -60,
                            }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                a: (props) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p
                                    style={{ margin: "0", lineHeight: "1.5" }}
                                    {...props}
                                  />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    style={{
                                      paddingLeft: "1.5em",
                                      margin: 0,
                                      paddingTop: 0,
                                      paddingBottom: 0,
                                      listStylePosition: "inside",
                                      lineHeight: "1.4",
                                    }}
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    style={{
                                      paddingLeft: "1.5em",
                                      margin: 0,
                                      paddingTop: 0,
                                      paddingBottom: 0,
                                      listStylePosition: "inside",
                                      lineHeight: "1.4",
                                    }}
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li
                                    style={{
                                      margin: 0,
                                      padding: 0,
                                      lineHeight: "1.4",
                                    }}
                                    {...props}
                                  />
                                ),
                                table: ({ node, ...props }) => (
                                  <div style={{ overflowX: "auto", margin: 0 }}>
                                    <table
                                      style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                      }}
                                      {...props}
                                    />
                                  </div>
                                ),
                                th: ({ node, ...props }) => (
                                  <th
                                    style={{
                                      border: "1px solid #ccc",
                                      padding: "0.5em",
                                      textAlign: "left",
                                    }}
                                    {...props}
                                  />
                                ),
                                td: ({ node, ...props }) => (
                                  <td
                                    style={{
                                      border: "1px solid #ccc",
                                      padding: "0.5em",
                                    }}
                                    {...props}
                                  />
                                ),
                                pre: ({ node, ...props }) => (
                                  <pre
                                    style={{
                                      background: "#f6f8fa",
                                      padding: "1em",
                                      margin: 0,
                                      borderRadius: "4px",
                                      overflowX: "auto",
                                    }}
                                    {...props}
                                  />
                                ),
                                code: ({
                                  node,
                                  inline,
                                  className,
                                  children,
                                  ...rest
                                }: any) =>
                                  inline ? (
                                    <code
                                      style={{
                                        background: "#f6f8fa",
                                        padding: "0.2em 0.4em",
                                        borderRadius: "4px",
                                        fontSize: "0.95em",
                                        lineHeight: "1.4",
                                      }}
                                      className={className}
                                      {...rest}
                                    >
                                      {children}
                                    </code>
                                  ) : (
                                    <code className={className} {...rest}>
                                      {children}
                                    </code>
                                  ),
                              }}
                            >
                              {m.text}
                            </ReactMarkdown>
                          </motion.div>
                        ))}
                        {loading && (
                          <div className="cb-loader">
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{
                                repeat: Infinity,
                                ease: "linear",
                                duration: 1,
                              }}
                            >
                              <AiOutlineLoading3Quarters size={22} />
                            </motion.span>
                            <span>{loaderText}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <footer className="cb-footer">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                      placeholder="Type your question…"
                      disabled={loading}
                    />
                    <button
                      onClick={send}
                      disabled={loading || !input.trim()}
                      className="cb-send-btn"
                    >
                      {loading ? (
                        <AiOutlineLoading3Quarters
                          className="cb-spin"
                          size={16}
                        />
                      ) : (
                        <AiOutlineSend size={18} />
                      )}
                    </button>
                  </footer>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portal,
        )}
    </>
  );
}
