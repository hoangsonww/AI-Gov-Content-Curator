import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { MdKey, MdDelete, MdEdit, MdCheck, MdClose } from "react-icons/md";
import {
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  renamePasskey,
  deletePasskey,
  PasskeySummary,
} from "../../services/api";
import { toast } from "react-toastify";

export default function PasskeysPage() {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [adding, setAdding] = useState<boolean>(false);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = async () => {
    try {
      const data = await listPasskeys();
      setPasskeys(data);
    } catch (err: any) {
      if (
        typeof err?.message === "string" &&
        /token|unauth/i.test(err.message)
      ) {
        router.replace("/auth/login");
        return;
      }
      setError(err.message || "Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSupported(isPasskeySupported());
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("token")) {
      router.replace("/auth/login");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    setError("");
    setAdding(true);
    try {
      const ua =
        (typeof navigator !== "undefined" && navigator.userAgent) || "";
      const defaultName = /iphone|ipad|ipod/i.test(ua)
        ? "iPhone / iPad"
        : /android/i.test(ua)
          ? "Android device"
          : /mac/i.test(ua)
            ? "Mac"
            : /windows/i.test(ua)
              ? "Windows device"
              : "Passkey";
      await registerPasskey(defaultName);
      toast("Passkey added 🔑");
      await refresh();
    } catch (err: any) {
      if (err?.name === "NotAllowedError") return;
      setError(err.message || "Could not add passkey");
      toast("Could not add passkey.");
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editingValue.trim()) return;
    try {
      await renamePasskey(id, editingValue.trim());
      setEditingId(null);
      setEditingValue("");
      toast("Renamed ✏️");
      await refresh();
    } catch (err: any) {
      setError(err.message || "Could not rename");
      toast("Could not rename passkey.");
    }
  };

  const handleDelete = async (id: string, nickname: string) => {
    if (
      !confirm(
        `Delete "${nickname}"? You will not be able to sign in with this device anymore.`,
      )
    )
      return;
    try {
      await deletePasskey(id);
      toast("Passkey removed 🗑️");
      await refresh();
    } catch (err: any) {
      setError(err.message || "Could not delete");
      toast(err.message || "Could not delete passkey.");
    }
  };

  return (
    <>
      <Head>
        <title>SynthoraAI - Manage Passkeys</title>
      </Head>
      <div className="login-container" style={{ maxWidth: 640 }}>
        <h1 className="login-title">Passkeys 🔑</h1>
        <p
          className="subtitle"
          style={{ textAlign: "center", marginBottom: "1.5rem" }}
        >
          Sign in faster with Face ID, Touch ID, Windows Hello, or a hardware
          key — no password needed.
        </p>

        {!supported && (
          <p className="error-msg">
            Your browser does not support passkeys. Try Chrome, Safari, or Edge
            on a recent OS.
          </p>
        )}
        {error && <p className="error-msg">{error}</p>}

        <div className="passkey-add-cta">
          <button
            type="button"
            className="passkey-btn"
            onClick={handleAdd}
            disabled={!supported || adding}
            aria-label="Add a passkey"
          >
            <MdKey size={18} className="passkey-icon" aria-hidden />
            {adding ? "Waiting…" : "Add a passkey"}
          </button>
        </div>

        {loading ? (
          <p className="passkey-empty">Loading passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="passkey-empty">You haven't added any passkeys yet.</p>
        ) : (
          <ul className="passkey-list">
            {passkeys.map((pk) => (
              <li key={pk.id} className="passkey-row">
                <div className="passkey-row-main">
                  <MdKey size={22} aria-hidden />
                  <div className="passkey-row-info">
                    {editingId === pk.id ? (
                      <input
                        autoFocus
                        className="form-input"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(pk.id);
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditingValue("");
                          }
                        }}
                        maxLength={64}
                        style={{ width: "100%" }}
                      />
                    ) : (
                      <strong className="passkey-row-name">
                        {pk.nickname}
                      </strong>
                    )}
                    <small className="passkey-row-meta">
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt &&
                        ` · last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                      {pk.deviceType === "multiDevice" && pk.backedUp
                        ? " · synced"
                        : ""}
                    </small>
                  </div>
                </div>
                <div className="passkey-row-actions">
                  {editingId === pk.id ? (
                    <>
                      <button
                        type="button"
                        className="passkey-icon-btn"
                        onClick={() => handleRename(pk.id)}
                        aria-label="Save"
                      >
                        <MdCheck size={18} />
                      </button>
                      <button
                        type="button"
                        className="passkey-icon-btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditingValue("");
                        }}
                        aria-label="Cancel"
                      >
                        <MdClose size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="passkey-icon-btn"
                        onClick={() => {
                          setEditingId(pk.id);
                          setEditingValue(pk.nickname);
                        }}
                        aria-label="Rename"
                      >
                        <MdEdit size={18} />
                      </button>
                      <button
                        type="button"
                        className="passkey-icon-btn danger"
                        onClick={() => handleDelete(pk.id, pk.nickname)}
                        aria-label="Delete"
                      >
                        <MdDelete size={18} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="form-links" style={{ marginTop: "1.5rem" }}>
          <p>
            <Link href="/home" legacyBehavior>
              <a>← Back to home</a>
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
