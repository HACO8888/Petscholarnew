"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { CommentNode } from "@/lib/comment-tree";
import { renderContentHtml } from "@/lib/rich-content";
import { formatDateTime } from "@/lib/format";
import CommentComposer from "@/components/CommentComposer";
import {
  adoptAnswer,
  reportComment,
  verifyAnswerAsTA,
} from "@/app/(app)/posts/actions";

interface ThreadProps {
  nodes: CommentNode[];
  postId: string;
  postAuthorId: string | null;
  currentUserId: string | null;
  currentUserRole: string | null;
  postSolved: boolean;
}

/** 從 server (socket) 收到的原始留言列形狀 */
interface RawComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  content: string;
  image: string | null;
  isAdopted: boolean;
  createdAt: string; // ISO
}

/** 把 socket 原始列轉成可渲染的 CommentNode（html/time 於 client 端產生）。 */
function rawToNode(r: RawComment): CommentNode {
  return {
    id: r.id,
    authorName: r.authorName,
    authorId: r.authorId,
    isAdopted: r.isAdopted,
    hidden: false,
    time: formatDateTime(new Date(r.createdAt)),
    contentHtml: r.content ? renderContentHtml(r.content) : "",
    image: r.image ?? null,
    children: [],
  };
}

/** 不可變地把 node 插入樹中（parentId 為 null 則插到頂層）。已存在則略過（去重）。 */
function insertNode(
  nodes: CommentNode[],
  node: CommentNode,
  parentId: string | null,
): CommentNode[] {
  if (existsInTree(nodes, node.id)) return nodes;
  if (!parentId) return [...nodes, node];
  let inserted = false;
  const walk = (list: CommentNode[]): CommentNode[] =>
    list.map((n) => {
      if (n.id === parentId) {
        inserted = true;
        return { ...n, children: [...n.children, node] };
      }
      if (n.children.length) return { ...n, children: walk(n.children) };
      return n;
    });
  const next = walk(nodes);
  // 父留言可能被隱藏/不在可見樹中（理論上少見）：退而附到頂層，避免訊息遺失
  return inserted ? next : [...nodes, node];
}

function existsInTree(nodes: CommentNode[], id: string): boolean {
  for (const n of nodes) {
    if (n.id === id) return true;
    if (n.children.length && existsInTree(n.children, id)) return true;
  }
  return false;
}

/** 不可變地把某 node 標記為已採納。 */
function markAdopted(nodes: CommentNode[], id: string): CommentNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, isAdopted: true };
    if (n.children.length)
      return { ...n, children: markAdopted(n.children, id) };
    return n;
  });
}

/** 附圖縮圖（可點開放大）。 */
function CommentImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block rounded-lg border border-outline-variant/40 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="放大檢視附圖"
      >
        <img
          src={src}
          alt="留言附圖"
          className="max-h-60 max-w-full object-contain"
          loading="lazy"
        />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <img
            src={src}
            alt="留言附圖（放大）"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            aria-label="關閉"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-on-surface shadow"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </>
  );
}

/**
 * 留言作者頭像（首字字母圈）＋名稱。
 */
function CommentAuthor({
  authorId,
  authorName,
  isAdopted,
}: {
  authorId: string | null;
  authorName: string;
  isAdopted: boolean;
}) {
  const initial = authorName.trim().charAt(0).toUpperCase() || "?";
  const avatar = (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        isAdopted
          ? "bg-primary text-on-primary"
          : "bg-secondary-container text-on-secondary-container"
      }`}
    >
      {initial}
    </span>
  );

  if (!authorId) {
    return (
      <span className="inline-flex items-center gap-x-2">
        {avatar}
        <span className="text-body-md font-semibold text-on-background break-words">{authorName}</span>
      </span>
    );
  }

  return (
    <Link
      href={`/u/${authorId}`}
      className="inline-flex items-center gap-x-2 rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {avatar}
      <span className="text-body-md font-semibold text-on-background break-words hover:underline">
        {authorName}
      </span>
    </Link>
  );
}

function CommentItem({
  node,
  postId,
  postAuthorId,
  currentUserId,
  currentUserRole,
  postSolved,
  depth,
  onReply,
  onAdopted,
}: {
  node: CommentNode;
  postId: string;
  postAuthorId: string | null;
  currentUserId: string | null;
  currentUserRole: string | null;
  postSolved: boolean;
  depth: number;
  onReply: (parentId: string, content: string, image: string | null) => Promise<boolean>;
  onAdopted: (commentId: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const canAdopt =
    currentUserId !== null &&
    currentUserId === postAuthorId &&
    !postSolved &&
    !node.isAdopted;
  const canVerify =
    currentUserId !== null &&
    currentUserRole === "ta" &&
    !postSolved &&
    !node.isAdopted;

  return (
    <div
      id={`comment-${node.id}`}
      className={`scroll-mt-24 rounded-xl border p-4 transition-colors ${
        node.isAdopted
          ? "border-primary bg-primary-container/40"
          : "border-outline-variant/30 bg-surface-container-low dark:bg-surface-container"
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <CommentAuthor
          authorId={node.authorId}
          authorName={node.authorName}
          isAdopted={node.isAdopted}
        />
        <span className="text-label-md text-secondary">{node.time}</span>
        {node.isAdopted && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-label-md font-medium text-on-primary">
            <span className="material-symbols-outlined text-[14px] icon-fill" aria-hidden>verified</span>
            已採納
          </span>
        )}
      </div>

      {node.contentHtml && (
        <div
          className="rich-content text-body-md leading-6 text-on-surface-variant"
          dangerouslySetInnerHTML={{ __html: node.contentHtml }}
        />
      )}
      {node.image && <CommentImage src={node.image} />}

      <div className="mt-2 flex items-center gap-3 text-label-md">
        {currentUserId ? (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="font-medium text-primary hover:underline"
          >
            回覆
          </button>
        ) : (
          <Link href="/login" className="text-secondary hover:underline">
            登入後回覆
          </Link>
        )}

        {canAdopt && (
          <form
            action={async (fd) => {
              await adoptAnswer(fd);
              onAdopted(node.id);
            }}
            className="inline"
          >
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="commentId" value={node.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-0.5 font-medium text-tertiary hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              採納此解答
            </button>
          </form>
        )}

        {canVerify && (
          <form
            action={async (fd) => {
              await verifyAnswerAsTA(fd);
              onAdopted(node.id);
            }}
            className="inline"
          >
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="commentId" value={node.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-0.5 font-medium text-tertiary hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              標記正解
            </button>
          </form>
        )}

        {currentUserId && (
          <button
            type="button"
            onClick={() => setReporting((v) => !v)}
            className="ml-auto inline-flex items-center gap-0.5 text-secondary hover:text-error hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">flag</span>
            檢舉
          </button>
        )}
      </div>

      {reporting && currentUserId && (
        <form
          action={async (fd) => {
            await reportComment(fd);
            setReporting(false);
          }}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="postId" value={postId} />
          <input type="hidden" name="commentId" value={node.id} />
          <input
            type="text"
            name="reason"
            placeholder="檢舉原因"
            maxLength={100}
            className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-label-md text-on-surface outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-full border border-outline-variant px-3 py-1 text-label-md text-on-surface-variant hover:bg-surface-container"
          >
            送出檢舉
          </button>
          <button
            type="button"
            onClick={() => setReporting(false)}
            className="rounded-full px-2 py-1 text-label-md text-secondary hover:underline"
          >
            取消
          </button>
        </form>
      )}

      {replying && currentUserId && (
        <div className="mt-2">
          <CommentComposer
            autoFocus
            rows={3}
            compact
            placeholder="輸入回覆內容（Enter 送出、Shift+Enter 換行，支援 $LaTeX$）"
            submitLabel="送出回覆"
            onCancel={() => setReplying(false)}
            onSubmit={async (content, image) => {
              const ok = await onReply(node.id, content, image);
              if (ok) setReplying(false);
              return ok;
            }}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <div className={`mt-3 space-y-3 border-l-2 pl-2.5 sm:pl-4 ${node.isAdopted ? "border-primary/40" : "border-outline-variant/30"}`}>
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              postId={postId}
              postAuthorId={postAuthorId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              postSolved={postSolved}
              depth={depth + 1}
              onReply={onReply}
              onAdopted={onAdopted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  nodes: initialNodes,
  postId,
  postAuthorId,
  currentUserId,
  currentUserRole,
  postSolved,
}: ThreadProps) {
  // 以 SSR nodes 為初值。之後即時更新由 socket 維護（同一文章本元件不會重掛）。
  const [nodes, setNodes] = useState<CommentNode[]>(initialNodes);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      query: { postId },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("comment:new", (raw: RawComment) => {
      setNodes((cur) => insertNode(cur, rawToNode(raw), raw.parentId));
    });

    socket.on("comment:adopted", ({ commentId }: { commentId: string }) => {
      setNodes((cur) => markAdopted(cur, commentId));
    });

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [postId]);

  // 透過 socket 送出留言。回傳是否成功（ack）。
  const sendComment = useCallback(
    (parentId: string | null, content: string, image: string | null) =>
      new Promise<boolean>((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          resolve(false);
          return;
        }
        let settled = false;
        const done = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        socket.emit(
          "comment:add",
          { postId, parentId, content, image },
          (ack: { ok: boolean; error?: string }) => done(Boolean(ack?.ok)),
        );
        // 保險：3 秒未收到 ack 視為失敗
        setTimeout(() => done(false), 3000);
      }),
    [postId],
  );

  const handleReply = useCallback(
    (parentId: string, content: string, image: string | null) =>
      sendComment(parentId, content, image),
    [sendComment],
  );

  // 採納/認證成功後：樂觀標記 + 通知 server 廣播給其他人
  const handleAdopted = useCallback(
    (commentId: string) => {
      setNodes((cur) => markAdopted(cur, commentId));
      socketRef.current?.emit("comment:adopt-notify", { commentId });
    },
    [],
  );

  const isEmpty = useMemo(() => nodes.length === 0, [nodes]);

  return (
    <div className="space-y-3">
      {isEmpty ? (
        <p className="text-body-md text-secondary">目前還沒有回覆，成為第一個解答的人吧！</p>
      ) : (
        nodes.map((node) => (
          <CommentItem
            key={node.id}
            node={node}
            postId={postId}
            postAuthorId={postAuthorId}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            postSolved={postSolved}
            depth={0}
            onReply={handleReply}
            onAdopted={handleAdopted}
          />
        ))
      )}

      {/* 頂層留言輸入（即時送出） */}
      <div
        id="reply-content"
        className="bg-surface-container-lowest dark:bg-surface-container-high p-lg rounded-xl border border-outline-variant/30 shadow-sm mt-lg scroll-mt-24"
      >
        <h3 className="font-bold text-body-md text-on-surface flex items-center gap-1 mb-md">
          <span className="material-symbols-outlined">edit_square</span> 撰寫您的解答 / 回覆
          {!connected && (
            <span className="ml-2 text-label-md font-normal text-secondary">連線中…</span>
          )}
        </h3>
        {currentUserId ? (
          <CommentComposer
            rows={5}
            disabled={!connected}
            placeholder="請詳細列出您的公式推導、參考資料或邏輯解釋…（Enter 送出、Shift+Enter 換行，支援 $LaTeX$）"
            submitLabel="發表解答"
            onSubmit={(content, image) => sendComment(null, content, image)}
          />
        ) : (
          <p className="text-secondary text-body-md">
            <Link href="/login" className="text-primary hover:underline">
              登入
            </Link>{" "}
            後即可發表解答。
          </p>
        )}
      </div>
    </div>
  );
}
