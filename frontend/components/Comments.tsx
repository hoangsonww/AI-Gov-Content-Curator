import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  useMemo,
} from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MdDelete,
  MdEdit,
  MdCheck,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdArrowUpward,
  MdArrowDownward,
  MdFilterList,
  MdRefresh,
} from "react-icons/md";
import {
  FaPlane,
  FaCat,
  FaDog,
  FaRocket,
  FaCarSide,
  FaGhost,
  FaIceCream,
  FaLeaf,
  FaSmile,
} from "react-icons/fa";
import {
  fetchCommentsForArticle,
  postComment,
  updateCommentAPI,
  deleteCommentAPI,
  voteCommentAPI,
  Comment,
} from "../services/comments";
import { toast } from "react-toastify";

interface CommentsProps {
  articleId: string;
}

/* ---------- helpers ---------- */
interface User {
  _id: string;
  name: string;
}
type VoteValue = -1 | 0 | 1;
interface CommentExt extends Comment {
  score: number;
  upvotes?: string[];
  downvotes?: string[];
}

function detectMention(text: string, cursor: number) {
  const up = text.slice(0, cursor);
  const at = up.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(up[at - 1]))) return null;
  return { start: at, query: up.slice(at + 1).toLowerCase() };
}

/* ---------- avatar palette ---------- */
const iconPalette = [
  FaPlane,
  FaCat,
  FaDog,
  FaRocket,
  FaCarSide,
  FaGhost,
  FaIceCream,
  FaLeaf,
  FaSmile,
];

export default function Comments({ articleId }: CommentsProps) {
  /* ---------- state ---------- */
  const perPage = 10;
  const [allComments, setAllComments] = useState<CommentExt[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  /* sort pop‑over */
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<
    "latest" | "earliest" | "most" | "least"
  >("latest");

  /* votes – commentId → my vote (‑1/0/1) */
  const [myVotes, setMyVotes] = useState<Record<string, VoteValue>>({});

  /* new / edit content */
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  /* mention */
  const [users, setUsers] = useState<User[]>([]);
  const [mentionMode, setMentionMode] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTarget, setMentionTarget] = useState<"new" | "edit">("new");

  /* delete confirm */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* refs */
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  /* avatar assignment (every icon used before repeat) */
  const iconAssign = useRef<Record<string, number>>({});
  const iconCounter = useRef(0);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const myId = useMemo(() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id as string;
    } catch {
      return null;
    }
  }, [token]);

  /* ---------- fetch ALL comments once ---------- */
  const load = useCallback(async () => {
    try {
      setLoading(true); // ← start
      /* ask backend for a lot – effectively “all” */
      const bigLimit = 1000;
      const { comments } = await fetchCommentsForArticle(
        articleId,
        1,
        bigLimit,
        token || undefined,
      );

      const ext: CommentExt[] = comments.map((c: any) => ({
        ...c,
        score: c.score ?? (c.upvotes?.length || 0) - (c.downvotes?.length || 0),
      }));

      /* capture my existing votes (if logged in) */
      if (myId) {
        const mine: Record<string, VoteValue> = {};
        ext.forEach((c) => {
          if (c.upvotes?.includes(myId)) mine[c._id] = 1;
          else if (c.downvotes?.includes(myId)) mine[c._id] = -1;
        });
        setMyVotes(mine);
      }

      setAllComments(ext);
      setPage(1); // reset page whenever re‑loading
    } catch {
      toast.error("Could not load comments.");
    } finally {
      setLoading(false); // ← stop
    }
  }, [articleId, token, myId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- users for mention ---------- */
  useEffect(() => {
    fetch("https://ai-content-curator-backend.vercel.app/api/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.data as User[]))
      .catch(() => console.error("Failed to fetch users"));
  }, []);

  /* ---------- mention logic ---------- */
  const handleMention = (
    text: string,
    cursor: number,
    setText: (s: string) => void,
    ref: React.RefObject<HTMLTextAreaElement>,
  ) => {
    const m = detectMention(text, cursor);
    if (m) {
      const matches = users.filter((u) =>
        u.name.toLowerCase().startsWith(m.query),
      );
      if (matches.length) {
        setFilteredUsers(matches);
        setMentionIndex(0);
        setMentionMode(true);
        return;
      }
    }
    setMentionMode(false);
  };

  const onNewChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMentionTarget("new");
    const val = e.target.value;
    setNewContent(val);
    // @ts-ignore
    handleMention(val, e.target.selectionStart, setNewContent, textareaRef);
  };
  const onEditChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMentionTarget("edit");
    const val = e.target.value;
    setEditingContent(val);
    // @ts-ignore
    handleMention(val, e.target.selectionStart, setEditingContent, editRef);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionMode) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredUsers.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      pickMention(filteredUsers[mentionIndex]);
    }
    if (e.key === "Escape") {
      setMentionMode(false);
    }
  };

  const pickMention = (u: User) => {
    const ref =
      mentionTarget === "new" ? textareaRef.current! : editRef.current!;
    const val = ref.value;
    const pos = ref.selectionStart;
    const up = val.slice(0, pos);
    const down = val.slice(pos);
    const atPos = up.lastIndexOf("@");
    const before = up.slice(0, atPos);
    const inserted = `@${u.name} `;
    const newText = before + inserted + down;

    if (mentionTarget === "new") {
      setNewContent(newText);
    } else {
      setEditingContent(newText);
    }

    setMentionMode(false);
    setTimeout(() => {
      ref.focus();
      ref.setSelectionRange(
        before.length + inserted.length,
        before.length + inserted.length,
      );
    }, 0);
  };

  /* ---------- create / edit ---------- */
  const handlePost = async () => {
    if (!newContent.trim() || !token) return;
    try {
      const saved = await postComment(articleId, newContent, token);
      const ext: CommentExt = { ...saved, score: 0 };
      setAllComments((prev) => [ext, ...prev]);
      setNewContent("");
      setSortBy("latest");
      setPage(1);
    } catch {
      toast.error("Failed to post comment.");
    }
  };

  const startEdit = (c: CommentExt) => {
    setEditingId(c._id);
    setEditingContent(c.content);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };
  const saveEdit = async () => {
    if (!editingId || !editingContent.trim() || !token) return;
    try {
      const updated = await updateCommentAPI(editingId, editingContent, token);
      setAllComments((p) =>
        p.map((c) =>
          c._id === editingId ? { ...c, content: updated.content } : c,
        ),
      );
      cancelEdit();
    } catch {
      toast.error("Failed to update.");
    }
  };

  /* ---------- delete ---------- */
  const onDeleteClick = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = async () => {
    if (!confirmDeleteId || !token) return;
    try {
      await deleteCommentAPI(confirmDeleteId, token);
      setAllComments((p) => p.filter((c) => c._id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch {
      toast.error("Failed to delete.");
    }
  };
  const cancelDelete = () => setConfirmDeleteId(null);

  /* ---------- votes ---------- */
  const vote = async (id: string, v: VoteValue) => {
    if (!token) {
      toast.info("You must be logged in to vote! 😊");
      return;
    }
    const prevVote = myVotes[id] ?? 0;

    /* optimistic UI */
    setAllComments((prev) =>
      prev.map((c) =>
        c._id === id ? { ...c, score: c.score - prevVote + v } : c,
      ),
    );
    setMyVotes((p) => ({ ...p, [id]: v }));

    try {
      await voteCommentAPI(id, v, token);
    } catch {
      /* rollback */
      setAllComments((prev) =>
        prev.map((c) =>
          c._id === id ? { ...c, score: c.score + prevVote - v } : c,
        ),
      );
      setMyVotes((p) => ({ ...p, [id]: prevVote }));
      toast.error("Vote failed.");
    }
  };

  const handleUp = (id: string) => {
    const cur = myVotes[id] ?? 0;
    if (!token) {
      toast.info("You must be logged in to vote! 😊");
      return;
    }
    vote(id, cur === 1 ? 0 : 1);
  };
  const handleDown = (id: string) => {
    const cur = myVotes[id] ?? 0;
    if (!token) {
      toast.info("You must be logged in to vote! 😊");
      return;
    }
    vote(id, cur === -1 ? 0 : -1);
  };

  /* ---------- sorted list + pagination ---------- */
  const sortedComments = useMemo(() => {
    const list = [...allComments];
    switch (sortBy) {
      case "latest":
        list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "earliest":
        list.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "most":
        list.sort((a, b) => b.score - a.score);
        break;
      case "least":
        list.sort((a, b) => a.score - b.score);
        break;
    }
    return list;
  }, [allComments, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedComments.length / perPage));
  const pageSlice = sortedComments.slice((page - 1) * perPage, page * perPage);

  /* ---------- outside‑click to close filter popover ---------- */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".filter-container")) {
        setSortOpen(false);
      }
    };
    if (sortOpen) window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  /* ---------- content renderer ---------- */
  const renderContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const mentionRegex = /@[^@\s]+(?:\s[^@\s]+)*(?=\s|$)/g;
    let last = 0,
      key = 0,
      m: RegExpExecArray | null;
    while ((m = mentionRegex.exec(text))) {
      if (m.index > last)
        parts.push(
          <React.Fragment key={key++}>
            {text.slice(last, m.index)}
          </React.Fragment>,
        );
      parts.push(<strong key={key++}>{m[0].trimEnd()}</strong>);
      last = m.index + m[0].length;
    }
    if (last < text.length)
      parts.push(
        <React.Fragment key={key++}>{text.slice(last)}</React.Fragment>,
      );
    return parts;
  };

  /* ---------- render ---------- */
  return (
    <motion.div
      className="comments-section"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* header + filter */}
      <div
        className="comments-header filter-container"
        style={{ position: "relative", display: "flex", alignItems: "center" }}
      >
        <h3 className="comments-title" style={{ flex: 1 }}>
          Discussion 💬
        </h3>
        <button
          className="icon-btn filter-btn"
          onClick={() => setSortOpen((o) => !o)}
          title="Sort comments"
        >
          <MdFilterList />
        </button>
        {sortOpen && (
          <div
            style={{
              position: "absolute",
              top: "2.8rem",
              right: 0,
              background: "var(--card-bg)",
              border: "var(--cb-border)",
              borderRadius: "var(--cb-radius)",
              boxShadow: "var(--cb-shadow)",
              padding: "0.5rem 0",
              zIndex: 200,
              minWidth: "220px",
            }}
          >
            {[
              ["latest", "Date (created) – latest"],
              ["earliest", "Date (created) – earliest"],
              ["most", "Most up-voted"],
              ["least", "Least up-voted"],
            ].map(([val, label]) => (
              <div
                key={val}
                className={`filter-option ${sortBy === val ? "active" : ""}`}
                onClick={() => {
                  setSortBy(val as any);
                  setPage(1);
                  setSortOpen(false);
                }}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="comments-subheading">
        Share your insights about this article below – your perspective could
        spark the next big idea!
      </p>

      {/* new comment box */}
      {!token ? (
        <div className="login-prompt">
          <Link href="/auth/login" legacyBehavior>
            <a className="login-link">Log in</a>
          </Link>{" "}
          to add your thoughts!
        </div>
      ) : (
        <div className="new-comment" style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            className="new-comment-textarea"
            value={newContent}
            onChange={onNewChange}
            onKeyDown={onKeyDown}
            placeholder="Write a comment…"
          />
          {mentionMode && mentionTarget === "new" && (
            <ul className="mention-popup show">
              {filteredUsers.map((u, idx) => (
                <li
                  key={u._id}
                  className={idx === mentionIndex ? "active" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(u);
                  }}
                >
                  {u.name}
                </li>
              ))}
            </ul>
          )}
          <button
            className="btn btn-primary new-comment-btn"
            onClick={handlePost}
          >
            Post
          </button>
        </div>
      )}

      {/* list (loading / empty / populated) */}
      {loading ? (
        <div
          className="comments-loading"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            justifyContent: "center",
            padding: "2rem 0",
            opacity: 0.8,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
            style={{ fontSize: "2rem", display: "inline-block" }}
          >
            <MdRefresh />
          </motion.div>
          <span>Loading comments…</span>
        </div>
      ) : pageSlice.length === 0 ? (
        <div className="comments-empty">
          <em>No comments/discussions yet for this article.</em>
        </div>
      ) : (
        pageSlice.map((c) => {
          const date = new Date(c.createdAt).toLocaleString();
          const isMine = myId === c.user._id;

          /* assign icon per comment */
          if (iconAssign.current[c._id] === undefined) {
            iconAssign.current[c._id] =
              iconCounter.current++ % iconPalette.length;
          }
          const AvatarIcon = iconPalette[iconAssign.current[c._id]];

          const myVote = myVotes[c._id] ?? 0;

          const inEdit = editingId === c._id;

          return (
            <div key={c._id} className="comment">
              <div className="meta">
                <AvatarIcon className="avatar" />
                <span className="author">{c.user.name || c.user.username}</span>
                <span className="date">{date}</span>
              </div>

              {/* content or edit box */}
              {inEdit ? (
                <div
                  className="edit-mode"
                  style={{ position: "relative", gap: "0.75rem" }}
                >
                  <textarea
                    ref={editRef}
                    className="edit-textarea"
                    value={editingContent}
                    onChange={onEditChange}
                    onKeyDown={onKeyDown}
                    style={{ marginBottom: "0.5rem" }}
                  />
                  {mentionMode && mentionTarget === "edit" && (
                    <ul className="mention-popup show">
                      {filteredUsers.map((u, idx2) => (
                        <li
                          key={u._id}
                          className={idx2 === mentionIndex ? "active" : ""}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickMention(u);
                          }}
                        >
                          {u.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="icon-btn"
                    onClick={saveEdit}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <MdCheck />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={cancelEdit}
                    style={{ alignSelf: "flex-start" }}
                  >
                    <MdClose />
                  </button>
                </div>
              ) : (
                <p className="content">{renderContent(c.content)}</p>
              )}

              {/* votes */}
              <div
                className="votes"
                style={inEdit ? { marginTop: "0.75rem" } : {}}
              >
                <button
                  className={`vote-btn ${myVote === 1 ? "active" : ""}`}
                  onClick={() => handleUp(c._id)}
                  title={token ? "Up‑vote" : "Log in to vote"}
                >
                  <MdArrowUpward />
                </button>
                <span className="score">{c.score}</span>
                <button
                  className={`vote-btn ${myVote === -1 ? "active" : ""}`}
                  onClick={() => handleDown(c._id)}
                  title={token ? "Down‑vote" : "Log in to vote"}
                >
                  <MdArrowDownward />
                </button>
              </div>

              {/* edit / delete for owner */}
              {isMine && !inEdit && (
                <div className="controls">
                  <button className="icon-btn" onClick={() => startEdit(c)}>
                    <MdEdit />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => onDeleteClick(c._id)}
                  >
                    <MdDelete />
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* delete confirm */}
      {confirmDeleteId && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>Are you sure you want to delete this comment?</p>
            <div className="confirm-actions">
              <motion.button
                className="btn"
                onClick={cancelDelete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                No
              </motion.button>
              <motion.button
                className="btn btn-primary"
                onClick={confirmDelete}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Yes
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* pagination */}
      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <MdChevronLeft />
        </button>
        <span className="page-indicator">
          Page {page} / {totalPages}
        </span>
        <button
          className="page-btn"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <MdChevronRight />
        </button>
      </div>
    </motion.div>
  );
}
