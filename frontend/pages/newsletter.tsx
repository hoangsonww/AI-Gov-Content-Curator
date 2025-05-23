import Head from "next/head";
import { useState } from "react";
import { MdCheckCircle, MdError, MdMailOutline } from "react-icons/md";
import { AiOutlineBell } from "react-icons/ai";
import { MdNotificationsOff } from "react-icons/md";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "";
    message: string;
  }>({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const API_BASE =
    "https://ai-content-curator-backend.vercel.app/api/newsletter";

  const handle = async (action: "subscribe" | "unsubscribe") => {
    if (!email.trim()) {
      setStatus({ type: "error", message: "Please enter your e-mail." });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const res = await fetch(`${API_BASE}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Unknown");

      const successMessage =
        action === "subscribe"
          ? data.message || "Subscribed successfully! 🎉"
          : data.message || "Unsubscribed successfully.";

      setStatus({ type: "success", message: successMessage });

      if (action === "subscribe") {
        toast.info(
          "Our newsletter will come from news@sonnguyenhoang.com. Be sure to add it to your contacts or whitelist the email address to ensure you don’t miss our newsletters.",
        );
      }
    } catch (err: any) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Newsletter – AI Content Curator</title>
        <meta
          name="description"
          content="Subscribe or unsubscribe to our daily AI-summarised newsletter."
        />
      </Head>

      <div className="container">
        <header>
          <MdMailOutline className="header-icon" size={35} />
          <h1>Newsletter Subscription</h1>
        </header>

        <p className="intro">
          Enter your e-mail to <strong>subscribe</strong> or{" "}
          <strong>unsubscribe</strong> from our daily AI-curated digest.
        </p>

        <div className="form">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-control"
            disabled={loading}
          />
          <div className="buttons">
            <button
              className="btn pulse"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={() => handle("subscribe")}
              disabled={loading}
            >
              <AiOutlineBell />
              Subscribe
            </button>
            <button
              className="btn pulse unsubscribe"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              onClick={() => handle("unsubscribe")}
              disabled={loading}
            >
              <MdNotificationsOff />
              Unsubscribe
            </button>
          </div>
        </div>

        {status.type && (
          <div className={`message ${status.type}`}>
            {status.type === "success" ? (
              <MdCheckCircle className="icon" />
            ) : (
              <MdError className="icon" />
            )}
            <span>{status.message}</span>
          </div>
        )}
      </div>

      {/* scoped styles */}
      <style jsx>{`
        .container {
          max-width: 480px;
          margin: 4rem auto;
          padding: 2rem;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          color: var(--text-color);
          text-align: center;
          opacity: 0;
          animation: slideDown 0.6s ease-out forwards;
          transition: background-color 0.3s ease;
        }
        header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1rem;
        }
        .header-icon {
          width: 64px;
          height: 64px;
          color: var(--accent-color);
          animation:
            float 3s ease-in-out infinite,
            pulse 2.5s ease-in-out infinite;
        }
        h1 {
          margin-top: 0.5rem;
          font-size: 1.75rem;
          animation: fadeIn 0.5s ease both 0.2s;
        }
        .intro {
          margin-bottom: 1.5rem;
          font-size: 1rem;
          line-height: 1.5;
          animation: fadeIn 0.5s ease both 0.3s;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        .input-control {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--card-border);
          border-radius: 4px;
          font-size: 1rem;
          background: var(--bg-color);
          color: var(--text-color);
          transition: border-color 0.2s ease;
        }
        .input-control:focus {
          outline: none;
          border-color: var(--accent-color);
        }
        .btn {
          padding: 0.6rem 1.2rem;
          font-size: 1rem;
          border: none;
          border-radius: 4px;
          background: var(--accent-color);
          color: #fff;
          cursor: pointer;
          transition:
            transform 0.2s,
            background 0.2s;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
          background: var(--hover-bg);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .unsubscribe {
          background: transparent;
          border: 1px solid var(--accent-color);
          color: var(--accent-color);
        }
        .unsubscribe:hover:not(:disabled) {
          background: var(--accent-color);
          color: #fff;
        }
        .message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
          font-size: 1rem;
          animation: fadeIn 0.5s ease;
        }
        .message.success {
          color: #28a745;
        }
        .message.error {
          color: #d63384;
        }
        .icon {
          font-size: 1.4rem;
        }
      `}</style>

      {/* global keyframes */}
      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </>
  );
}
