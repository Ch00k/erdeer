import { useCallback, useRef, useState } from "react";
import {
  addComment,
  createThread,
  deleteComment,
  deleteThread,
  editComment,
  resolveThread,
} from "../api.js";
import { useAuth } from "../auth.js";
import type { CommentThread } from "../types.js";
import styles from "./CommentsPanel.module.css";
import { ConfirmDialog } from "./ConfirmDialog.js";

export interface Anchor {
  type: "diagram" | "entity" | "column";
  entity?: string;
  column?: string;
}

interface CommentsPanelProps {
  diagramId: string;
  threads: CommentThread[];
  activeAnchor: Anchor | null;
  onClose: () => void;
  onThreadsChange: (threads: CommentThread[]) => void;
  onClearAnchor: () => void;
}

function anchorLabel(thread: CommentThread): string {
  if (thread.anchorType === "column" && thread.anchorEntity && thread.anchorColumn) {
    return `${thread.anchorEntity}.${thread.anchorColumn}`;
  }
  if (thread.anchorType === "entity" && thread.anchorEntity) {
    return thread.anchorEntity;
  }
  return "Diagram";
}

function anchorMatches(thread: CommentThread, anchor: Anchor): boolean {
  if (thread.anchorType !== anchor.type) return false;
  if (anchor.type === "diagram") return true;
  if (anchor.type === "entity") return thread.anchorEntity === anchor.entity;
  return thread.anchorEntity === anchor.entity && thread.anchorColumn === anchor.column;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentsPanel({
  diagramId,
  threads,
  activeAnchor,
  onClose,
  onThreadsChange,
  onClearAnchor,
}: CommentsPanelProps) {
  const { user } = useAuth();
  const [newThreadBody, setNewThreadBody] = useState("");
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<{ id: string; body: string } | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "thread" | "comment";
    threadId: string;
    commentId?: string;
  } | null>(null);
  const newThreadInputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    const { fetchThreads } = await import("../api.js");
    const updated = await fetchThreads(diagramId);
    onThreadsChange(updated);
  }, [diagramId, onThreadsChange]);

  const handleCreateThread = useCallback(async () => {
    if (!newThreadBody.trim() || !activeAnchor) return;
    await createThread(diagramId, {
      anchorType: activeAnchor.type,
      anchorEntity: activeAnchor.entity,
      anchorColumn: activeAnchor.column,
      body: newThreadBody.trim(),
    });
    setNewThreadBody("");
    await refresh();
  }, [diagramId, activeAnchor, newThreadBody, refresh]);

  const handleReply = useCallback(
    async (threadId: string) => {
      const body = replyBodies[threadId];
      if (!body?.trim()) return;
      await addComment(diagramId, threadId, body.trim());
      setReplyBodies((prev) => ({ ...prev, [threadId]: "" }));
      await refresh();
    },
    [diagramId, replyBodies, refresh],
  );

  const handleEditSave = useCallback(
    async (threadId: string) => {
      if (!editingComment?.body.trim()) return;
      await editComment(diagramId, threadId, editingComment.id, editingComment.body.trim());
      setEditingComment(null);
      await refresh();
    },
    [diagramId, editingComment, refresh],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "thread") {
      await deleteThread(diagramId, confirmDelete.threadId);
    } else if (confirmDelete.commentId) {
      await deleteComment(diagramId, confirmDelete.threadId, confirmDelete.commentId);
    }
    setConfirmDelete(null);
    await refresh();
  }, [diagramId, confirmDelete, refresh]);

  const handleResolve = useCallback(
    async (threadId: string, resolved: boolean) => {
      await resolveThread(diagramId, threadId, resolved);
      await refresh();
    },
    [diagramId, refresh],
  );

  // Filter and sort threads
  const filteredThreads = activeAnchor
    ? threads.filter((t) => anchorMatches(t, activeAnchor))
    : threads;
  const unresolvedThreads = filteredThreads.filter((t) => !t.resolvedAt);
  const resolvedThreads = filteredThreads.filter((t) => t.resolvedAt);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Comments</span>
        <button className={styles.closeButton} onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className={styles.content}>
        {/* Active anchor filter indicator */}
        {activeAnchor && (
          <div className={styles.anchorFilter}>
            <span className={styles.anchorFilterLabel}>
              {activeAnchor.type === "diagram"
                ? "Diagram"
                : activeAnchor.type === "column"
                  ? `${activeAnchor.entity}.${activeAnchor.column}`
                  : activeAnchor.entity}
            </span>
            <button
              className={styles.anchorFilterClear}
              onClick={onClearAnchor}
              title="Show all comments"
            >
              Show all
            </button>
          </div>
        )}

        {/* New thread form */}
        {activeAnchor && (
          <div className={styles.newThread}>
            <textarea
              ref={newThreadInputRef}
              className={styles.textarea}
              placeholder="Start a new thread..."
              value={newThreadBody}
              onChange={(e) => setNewThreadBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleCreateThread();
                }
              }}
              rows={2}
            />
            <div className={styles.newThreadActions}>
              <button
                className={styles.submitButton}
                onClick={handleCreateThread}
                disabled={!newThreadBody.trim()}
              >
                Comment
              </button>
            </div>
          </div>
        )}

        {!activeAnchor && unresolvedThreads.length === 0 && resolvedThreads.length === 0 && (
          <div className={styles.empty}>
            No comments yet. Click on a table or column to start a thread.
          </div>
        )}

        {/* Unresolved threads */}
        {unresolvedThreads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            currentUserId={user?.id ?? ""}
            replyBody={replyBodies[thread.id] ?? ""}
            editingComment={editingComment}
            onReplyChange={(body) => setReplyBodies((prev) => ({ ...prev, [thread.id]: body }))}
            onReply={() => handleReply(thread.id)}
            onResolve={() => handleResolve(thread.id, true)}
            onDeleteThread={() => setConfirmDelete({ type: "thread", threadId: thread.id })}
            onEditStart={(id, body) => setEditingComment({ id, body })}
            onEditChange={(body) => setEditingComment((prev) => (prev ? { ...prev, body } : null))}
            onEditSave={() => handleEditSave(thread.id)}
            onEditCancel={() => setEditingComment(null)}
            onDeleteComment={(commentId) =>
              setConfirmDelete({ type: "comment", threadId: thread.id, commentId })
            }
          />
        ))}

        {/* Resolved threads */}
        {resolvedThreads.length > 0 && (
          <div className={styles.resolvedSection}>
            <button className={styles.resolvedToggle} onClick={() => setShowResolved((v) => !v)}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className={showResolved ? styles.chevronOpen : styles.chevronClosed}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Resolved ({resolvedThreads.length})
            </button>
            {showResolved &&
              resolvedThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  currentUserId={user?.id ?? ""}
                  replyBody={replyBodies[thread.id] ?? ""}
                  editingComment={editingComment}
                  onReplyChange={(body) =>
                    setReplyBodies((prev) => ({ ...prev, [thread.id]: body }))
                  }
                  onReply={() => handleReply(thread.id)}
                  onResolve={() => handleResolve(thread.id, false)}
                  onDeleteThread={() => setConfirmDelete({ type: "thread", threadId: thread.id })}
                  onEditStart={(id, body) => setEditingComment({ id, body })}
                  onEditChange={(body) =>
                    setEditingComment((prev) => (prev ? { ...prev, body } : null))
                  }
                  onEditSave={() => handleEditSave(thread.id)}
                  onEditCancel={() => setEditingComment(null)}
                  onDeleteComment={(commentId) =>
                    setConfirmDelete({ type: "comment", threadId: thread.id, commentId })
                  }
                />
              ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete?.type === "thread" ? "Delete thread" : "Delete comment"}
        message={
          confirmDelete?.type === "thread"
            ? "This will delete the thread and all its comments. This action cannot be undone."
            : "This will delete your comment. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

interface ThreadItemProps {
  thread: CommentThread;
  currentUserId: string;
  replyBody: string;
  editingComment: { id: string; body: string } | null;
  onReplyChange: (body: string) => void;
  onReply: () => void;
  onResolve: () => void;
  onDeleteThread: () => void;
  onEditStart: (commentId: string, body: string) => void;
  onEditChange: (body: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDeleteComment: (commentId: string) => void;
}

function ThreadItem({
  thread,
  currentUserId,
  replyBody,
  editingComment,
  onReplyChange,
  onReply,
  onResolve,
  onDeleteThread,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDeleteComment,
}: ThreadItemProps) {
  return (
    <div className={`${styles.thread} ${thread.resolvedAt ? styles.threadResolved : ""}`}>
      <div className={styles.threadHeader}>
        <span className={styles.anchorLabel}>{anchorLabel(thread)}</span>
        <div className={styles.threadActions}>
          <button
            className={styles.iconButton}
            onClick={onResolve}
            title={thread.resolvedAt ? "Unresolve" : "Resolve"}
          >
            {thread.resolvedAt ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M11.5 3.5L5.5 10.5L2.5 7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M4.5 7L6.5 9L9.5 5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {thread.createdBy.id === currentUserId && (
            <button className={styles.iconButton} onClick={onDeleteThread} title="Delete thread">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v3M8 6.5v3M4.5 4l.5 7a1 1 0 001 1h2a1 1 0 001-1l.5-7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className={styles.commentList}>
        {thread.comments.map((comment) => (
          <div key={comment.id} className={styles.comment}>
            <div className={styles.commentHeader}>
              <span className={styles.commentAuthor}>{comment.user.name}</span>
              <span className={styles.commentTime}>{timeAgo(comment.createdAt)}</span>
              {comment.user.id === currentUserId && (
                <div className={styles.commentActions}>
                  <button
                    className={styles.textButton}
                    onClick={() => onEditStart(comment.id, comment.body)}
                  >
                    Edit
                  </button>
                  <button className={styles.textButton} onClick={() => onDeleteComment(comment.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
            {editingComment?.id === comment.id ? (
              <div className={styles.editForm}>
                <textarea
                  className={styles.textarea}
                  value={editingComment.body}
                  onChange={(e) => onEditChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onEditSave();
                    if (e.key === "Escape") onEditCancel();
                  }}
                  rows={2}
                />
                <div className={styles.editActions}>
                  <button className={styles.submitButton} onClick={onEditSave}>
                    Save
                  </button>
                  <button className={styles.cancelButton} onClick={onEditCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.commentBody}>{comment.body}</div>
            )}
          </div>
        ))}
      </div>

      {/* Reply input */}
      <div className={styles.replyForm}>
        <textarea
          className={styles.textarea}
          placeholder="Reply..."
          value={replyBody}
          onChange={(e) => onReplyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onReply();
          }}
          rows={1}
        />
        {replyBody.trim() && (
          <button className={styles.submitButton} onClick={onReply}>
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
