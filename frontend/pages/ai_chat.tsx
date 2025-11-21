import React, { useState, useEffect, useRef } from "react";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  time?: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function SendIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M22 2L11 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: "c-1",
      title: "General",
      messages: [
        {
          id: "m-welcome",
          role: "ai",
          text: "Hello!",
          time: nowTime(),
        },
      ],
    },
  ]);
  const [activeConvId, setActiveConvId] = useState("c-1");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length, isTyping]);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const msg: Message = { id: `m-${Date.now()}`, role: "user", text, time: nowTime() };
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, messages: [...c.messages, msg] } : c))
    );
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: `m-ai-${Date.now()}`,
        role: "ai",
        text: "This is a simulated AI reply. Connect your backend to replace it.",
        time: nowTime(),
      };
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, messages: [...c.messages, aiMsg] } : c))
      );
      setIsTyping(false);
    }, 1000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function createNewConversation() {
    const id = `c-${Date.now()}`;
    const conv: Conversation = { id, title: "New Chat", messages: [] };
    setConversations([conv, ...conversations]);
    setActiveConvId(id);
  }

  function renameConversation(conv: Conversation) {
    const name = prompt("Rename conversation", conv.title)?.trim();
    if (name) setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title: name } : c)));
  }

  function clearConversation(convId: string) {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, messages: [] } : c)));
  }

  return (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    renameConversation(conv);
                  }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearConversation(conv.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Main */}
      <main className="chat-main">
        <div className="messages-container">
          {activeConversation?.messages.length === 0 && !isTyping && (
            <div className="empty-state">Start the conversation</div>
          )}

          {activeConversation?.messages.map((m) => (
            <div key={m.id} className={`message-row ${m.role}`}>
              <div className={`message-bubble ${m.role}`}>
                <div className="message-text">{m.text}</div>
                <div className="message-time">{m.time}</div>
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
            sendMessage(input);
          }}
        >
          <textarea
            className="composer-input"
            placeholder="Your message here...."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="btn-send" type="submit">
            <SendIcon />
          </button>
        </form>
      </main>

      <style jsx>{`
        .chat-root {
          display: grid;
          grid-template-columns: 300px 1fr;
          height: 100vh;
          background: #0f0f0f;
          color: #fff;
          gap: 20px;
          padding: 20px;
          font-family: "Inter", sans-serif;
        }

        /* Sidebar */
        .sidebar {
          background: #1b1b1b;
          border-radius: 24px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
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
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          padding: 6px 14px;
          border-radius: 9999px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: all 0.2s ease-in-out;
        }
        .btn-new:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
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
          background: #2a2a2a;
          transform: translateX(2px);
        }
        .conv-item.active {
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          color: #fff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        }

        .conv-actions button {
          background: transparent;
          border: none;
          color: #9ca3af;
          margin-left: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: color 0.2s;
        }
        .conv-actions button:hover {
          color: #fff;
        }

        /* Chat main */
        .chat-main {
          display: flex;
          flex-direction: column;
          background: #161616;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .empty-state {
          text-align: center;
          color: #9ca3af;
          padding: 32px;
          font-size: 14px;
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
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          transition: transform 0.1s;
        }
        .message-bubble.user {
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          color: white;
        }
        .message-bubble.ai {
          background: #2a2a2a;
          color: #fff;
        }

        .message-bubble:hover {
          transform: translateY(-1px);
        }

        .message-time {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 6px;
          text-align: right;
        }

        .typing-bubble {
          display: flex;
          gap: 4px;
          background: #2a2a2a;
          padding: 8px 14px;
          border-radius: 20px;
          color: #3b82f6;
          font-weight: bold;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Composer */
        .composer {
          display: flex;
          padding: 18px 24px;
          border-top: 1px solid #2c2c2c;
          gap: 12px;
        }

        .composer-input {
          flex: 1;
          border: none;
          border-radius: 22px;
          padding: 14px 18px;
          background: #121212;
          color: white;
          resize: none;
          font-size: 14px;
          outline: none;
          transition: box-shadow 0.2s ease-in-out;
        }

        .composer-input:focus {
          box-shadow: 0 0 0 2px #3b82f6;
        }

        .btn-send {
          background: linear-gradient(90deg, #3b82f6, #2563eb);
          border: none;
          border-radius: 22px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .btn-send:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }
      `}</style>
    </div>
  );
}
