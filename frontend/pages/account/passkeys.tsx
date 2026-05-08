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
      const defaultName =
        typeof navigator !== "undefined" &&
        /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "iPhone / iPad"
          : /android/i.test(navigator?.userAgent || "")
            ? "Android device"
            : /mac/i.test(navigator?.userAgent || "")
              ? "Mac"
              : /windows/i.test(navigator?.userAgent || "")
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

        <button
          type="button"
          className="btn submit-btn"
          onClick={handleAdd}
          disabled={!supported || adding}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <MdKey size={20} />
          {adding ? "Waiting…" : "Add a passkey"}
        </button>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted-text, #888)" }}>
            Loading passkeys…
          </p>
        ) : passkeys.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted-text, #888)" }}>
            You haven't added any passkeys yet.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {passkeys.map((pk) => (
              <li
                key={pk.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1rem",
                  borderRadius: 8,
                  border:
                    "1px solid var(--border-color, rgba(127,127,127,0.25))",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <MdKey size={22} aria-hidden />
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      <strong
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pk.nickname}
                      </strong>
                    )}
                    <small style={{ color: "var(--muted-text, #888)" }}>
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                      {pk.lastUsedAt &&
                        ` · last used ${new Date(pk.lastUsedAt).toLocaleDateString()}`}
                      {pk.deviceType === "multiDevice" && pk.backedUp
                        ? " · synced"
                        : ""}
                    </small>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {editingId === pk.id ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleRename(pk.id)}
                        aria-label="Save"
                        style={{ padding: "0.4rem 0.6rem" }}
                      >
                        <MdCheck size={18} />
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditingValue("");
                        }}
                        aria-label="Cancel"
                        style={{ padding: "0.4rem 0.6rem" }}
                      >
                        <MdClose size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setEditingId(pk.id);
                          setEditingValue(pk.nickname);
                        }}
                        aria-label="Rename"
                        style={{ padding: "0.4rem 0.6rem" }}
                      >
                        <MdEdit size={18} />
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleDelete(pk.id, pk.nickname)}
                        aria-label="Delete"
                        style={{ padding: "0.4rem 0.6rem" }}
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
