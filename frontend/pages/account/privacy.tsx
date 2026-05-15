import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { MdDownload, MdDeleteForever, MdWarning, MdCheck } from "react-icons/md";
import {
  downloadUserDataExport,
  requestAccountDeletion,
  cancelAccountDeletion,
  confirmDeleteAccount,
  clearAuthToken,
  getAuthToken,
} from "../../services/api";
import { toast } from "react-toastify";

type DeletionStep = "idle" | "confirming" | "requested" | "done";

export default function PrivacyPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionStep, setDeletionStep] = useState<DeletionStep>("idle");
  const [emailedCode, setEmailedCode] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!getAuthToken()) router.replace("/auth/login");
  }, [router]);

  useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await downloadUserDataExport();
      toast.success("Data export downloaded.");
    } catch (err: any) {
      toast.error(err.message || "Export failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleRequestDeletion = async () => {
    setDeleteLoading(true);
    try {
      await requestAccountDeletion();
      setDeletionStep("requested");
      toast.success("Confirmation code sent — check your email.");
    } catch (err: any) {
      toast.error(err.message || "Could not initiate deletion. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!emailedCode.trim() || confirmText !== "DELETE") return;
    setDeleteLoading(true);
    try {
      await confirmDeleteAccount(emailedCode.trim().toUpperCase());
      setDeletionStep("done");
      clearAuthToken();
      toast.success("Your account has been permanently deleted.");
      redirectTimer.current = setTimeout(() => router.replace("/"), 2500);
    } catch (err: any) {
      toast.error(err.message || "Deletion failed. The code may be wrong or expired.");
      setEmailedCode("");
      setConfirmText("");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDeletion = () => {
    // Fire-and-forget — clears the token from the DB so it doesn't linger.
    cancelAccountDeletion().catch(() => {});
    setDeletionStep("idle");
    setEmailedCode("");
    setConfirmText("");
  };

  return (
    <>
      <Head>
        <title>Privacy & Data — SynthoraAI</title>
      </Head>

      <div className="login-container" style={{ maxWidth: 660 }}>
        <h1 className="login-title">Privacy &amp; Data</h1>
        <p className="subtitle" style={{ textAlign: "center", marginBottom: "2rem" }}>
          Manage your personal data in accordance with your privacy rights.
        </p>

        {/* ── Data Export ──────────────────────────────────────────────── */}
        <div className="privacy-section">
          <h2 className="privacy-section-title">
            <MdDownload size={20} aria-hidden />
            Export your data
          </h2>
          <p className="privacy-section-desc">
            Download a JSON file containing your profile, favourited articles,
            comments, ratings, passkey metadata, and newsletter subscription.
            Password hashes and security keys are excluded.
          </p>
          <button
            className="passkey-btn"
            onClick={handleExport}
            disabled={exportLoading}
            style={{ marginTop: "0.75rem" }}
          >
            <span className="passkey-icon">
              <MdDownload size={18} aria-hidden />
            </span>
            {exportLoading ? "Preparing export…" : "Download my data"}
          </button>
        </div>

        {/* ── Account Deletion ──────────────────────────────────────────── */}
        <div className="privacy-section privacy-danger-section">
          <h2 className="privacy-section-title privacy-danger-title">
            <MdDeleteForever size={20} aria-hidden />
            Delete account
          </h2>

          {deletionStep === "done" && (
            <div className="privacy-banner privacy-banner-success">
              <MdCheck size={18} />
              Account deleted — redirecting…
            </div>
          )}

          {deletionStep === "idle" && (
            <>
              <p className="privacy-section-desc">
                Permanently delete your account and all associated data —
                comments, ratings, passkeys, and newsletter subscription.{" "}
                <strong>This cannot be undone.</strong>
              </p>
              <button
                className="passkey-btn privacy-delete-btn"
                onClick={() => setDeletionStep("confirming")}
                style={{ marginTop: "0.75rem" }}
              >
                <span className="passkey-icon">
                  <MdWarning size={16} aria-hidden />
                </span>
                Request account deletion
              </button>
            </>
          )}

          {deletionStep === "confirming" && (
            <>
              <p className="privacy-section-desc">
                Click <strong>Send confirmation code</strong> — we'll email a
                one-time code to your registered address (valid for{" "}
                <strong>1 hour</strong>). You'll then enter the code and type{" "}
                <code>DELETE</code> to confirm.
              </p>
              <div className="privacy-btn-row">
                <button
                  className="passkey-btn privacy-delete-btn"
                  onClick={handleRequestDeletion}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? "Sending…" : "Send confirmation code"}
                </button>
                <button
                  className="passkey-btn"
                  onClick={handleCancelDeletion}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {deletionStep === "requested" && (
            <>
              <div className="privacy-banner privacy-banner-warning">
                <MdWarning size={18} />
                A confirmation code was sent to your email — it expires in 1 hour.
              </div>
              <p className="privacy-section-desc">
                Enter the code from your email, then type <code>DELETE</code>{" "}
                and click <strong>Permanently delete my account</strong>.
              </p>
              <input
                type="text"
                className="form-input"
                placeholder="Confirmation code from email"
                value={emailedCode}
                onChange={(e) => setEmailedCode(e.target.value.toUpperCase())}
                autoComplete="one-time-code"
                style={{ marginBottom: "0.75rem", letterSpacing: "0.1em" }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Type DELETE to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                style={{ marginBottom: "1rem" }}
              />
              <div className="privacy-btn-row">
                <button
                  className="passkey-btn privacy-delete-btn"
                  onClick={handleConfirmDeletion}
                  disabled={
                    deleteLoading ||
                    !emailedCode.trim() ||
                    confirmText !== "DELETE"
                  }
                >
                  {deleteLoading ? "Deleting…" : "Permanently delete my account"}
                </button>
                <button
                  className="passkey-btn"
                  onClick={handleCancelDeletion}
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {/* Back link */}
        <div className="form-links" style={{ marginTop: "1.5rem" }}>
          <Link href="/" legacyBehavior>
            <a>← Back to Home</a>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .privacy-section {
          border: 1px solid var(--card-border, rgba(127, 127, 127, 0.3));
          border-radius: 10px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.25rem;
        }

        .privacy-danger-section {
          border-color: rgba(220, 53, 69, 0.3);
        }

        .privacy-section-title {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0 0 0.6rem;
          color: var(--text-color, #1a1a1a);
        }

        .privacy-danger-title {
          color: #c82333;
        }

        .privacy-section-desc {
          font-size: 0.9rem;
          color: var(--muted-text, #666);
          line-height: 1.55;
          margin: 0;
        }

        .privacy-section-desc code {
          font-family: monospace;
          background: var(--card-border, rgba(127, 127, 127, 0.12));
          padding: 0.1em 0.35em;
          border-radius: 3px;
        }

        .privacy-delete-btn {
          border-color: rgba(220, 53, 69, 0.5) !important;
          color: #dc3545 !important;
        }

        .privacy-delete-btn:hover:not(:disabled) {
          background: rgba(220, 53, 69, 0.07) !important;
          border-color: #dc3545 !important;
          box-shadow: 0 4px 14px rgba(220, 53, 69, 0.15) !important;
        }

        .privacy-btn-row {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .privacy-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1rem;
          border-radius: 8px;
          font-size: 0.88rem;
          margin-bottom: 1rem;
        }

        .privacy-banner-warning {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.4);
          color: var(--text-color, #1a1a1a);
        }

        .privacy-banner-success {
          background: rgba(40, 167, 69, 0.1);
          border: 1px solid rgba(40, 167, 69, 0.4);
          color: var(--text-color, #1a1a1a);
        }
      `}</style>
    </>
  );
}
