import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  ChangeEvent,
  KeyboardEvent,
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
} from "react-icons/md";
import {
  fetchCommentsForArticle,
  postComment,
  updateCommentAPI,
  deleteCommentAPI,
  Comment,
  CommentPage,
} from "../services/comments";
import { toast } from "react-toastify";

interface CommentsProps {
  articleId: string;
}

interface User {
  _id: string;
  name: string;
}

function detectMention(text: string, cursor: number) {
  const up = text.slice(0, cursor);
  const at = up.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(up[at - 1]))) return null;
  return { start: at, query: up.slice(at + 1).toLowerCase() };
}

export default function Comments({ articleId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [mentionMode, setMentionMode] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTarget, setMentionTarget] = useState<"new" | "edit">("new");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // load comments
  const load = useCallback(async () => {
    try {
      const { comments, hasMore } = (await fetchCommentsForArticle(
        articleId,
        page,
        10,
        token || undefined,
      )) as CommentPage;
      setComments(comments);
      setHasMore(hasMore);
    } catch {
      toast.error("Could not load comments.");
    }
  }, [articleId, page, token]);
  useEffect(() => {
    load();
  }, [load]);

  // prefetch all users
  useEffect(() => {
    fetch("https://ai-content-curator-backend.vercel.app/api/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.data as User[]))
      .catch(() => console.error("Failed to fetch users"));
  }, []);

  // shared mention logic for both textareas
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

  // post new comment
  const handlePost = async () => {
    if (!newContent.trim() || !token) return;
    try {
      const saved = await postComment(articleId, newContent, token);
      setComments((p) => [saved, ...p].slice(0, 10));
      setNewContent("");
    } catch {
      toast.error("Failed to post comment.");
    }
  };

  // edit existing
  const startEdit = (c: Comment) => {
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
      setComments((p) => p.map((c) => (c._id === editingId ? updated : c)));
      cancelEdit();
    } catch {
      toast.error("Failed to update.");
    }
  };

  // delete flow
  const onDeleteClick = (id: string) => setConfirmDeleteId(id);
  const confirmDelete = async () => {
    if (!confirmDeleteId || !token) return;
    try {
      await deleteCommentAPI(confirmDeleteId, token);
      setComments((p) => p.filter((c) => c._id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch {
      toast.error("Failed to delete.");
    }
  };
  const cancelDelete = () => setConfirmDeleteId(null);

  const renderContent = (text: string) =>
    text
      .split(/(@[^\s]+)/g)
      .map((part, i) =>
        part.startsWith("@") ? (
          <strong key={i}>{part}</strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      );

  return (
    <motion.div
      className="comments-section"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h3 className="comments-title">Discussion 💬</h3>
      <p className="comments-subheading">
        Share your insights about this article below – your perspective could
        spark the next big idea!
      </p>

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

      {comments.length === 0 ? (
        <div className="comments-empty">
          <em>No comments/discussions yet for this article.</em>
        </div>
      ) : (
        comments.map((c) => {
          const date = new Date(c.createdAt).toLocaleString();
          let isMine = false;
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split(".")[1]));
              isMine = payload.id === c.user._id;
            } catch {}
          }
          return (
            <div key={c._id} className="comment">
              <div className="meta">
                <span className="author">{c.user.name || c.user.username}</span>
                <span className="date">{date}</span>
              </div>

              {editingId === c._id ? (
                <div className="edit-mode" style={{ position: "relative" }}>
                  <textarea
                    ref={editRef}
                    className="edit-textarea"
                    value={editingContent}
                    onChange={onEditChange}
                    onKeyDown={onKeyDown}
                  />
                  {mentionMode && mentionTarget === "edit" && (
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
                  <button className="icon-btn" onClick={saveEdit}>
                    <MdCheck />
                  </button>
                  <button className="icon-btn" onClick={cancelEdit}>
                    <MdClose />
                  </button>
                </div>
              ) : (
                <p className="content">{renderContent(c.content)}</p>
              )}

              {isMine && editingId !== c._id && (
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

      {/* Confirmation dialog */}
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

      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <MdChevronLeft />
        </button>
        <span className="page-indicator">Page {page}</span>
        <button
          className="page-btn"
          onClick={() => hasMore && setPage((p) => p + 1)}
          disabled={!hasMore}
        >
          <MdChevronRight />
        </button>
      </div>
    </motion.div>
  );
}
