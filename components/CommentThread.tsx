"use client";

import Link from "next/link";
import { useState } from "react";
import type { CommentNode } from "@/lib/comment-tree";
import {
  addComment,
  adoptAnswer,
  reportComment,
  verifyAnswerAsTA,
} from "@/app/posts/actions";

interface ThreadProps {
  nodes: CommentNode[];
  postId: string;
  postAuthorId: string | null;
  currentUserId: string | null;
  currentUserRole: string | null;
  postSolved: boolean;
  depth?: number;
}

function ReplyForm({
  postId,
  parentId,
  onDone,
}: {
  postId: string;
  parentId: string;
  onDone: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        await addComment(fd);
        onDone();
      }}
      className="mt-2 space-y-2"
    >
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentId" value={parentId} />
      <textarea
        name="content"
        required
        rows={3}
        placeholder="輸入回覆內容（支援 $LaTeX$ 數學式）"
        className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface outline-none focus:border-primary"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-1.5 text-label-md font-bold text-on-primary transition-all hover:bg-surface-tint"
        >
          送出回覆
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-outline-variant px-4 py-1.5 text-label-md text-on-surface-variant hover:bg-surface-container"
        >
          取消
        </button>
      </div>
    </form>
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
}: {
  node: CommentNode;
  postId: string;
  postAuthorId: string | null;
  currentUserId: string | null;
  currentUserRole: string | null;
  postSolved: boolean;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  // 與 legacy 一致：只有在提問尚未解決時，才顯示採納/認證鈕
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
      <div className="mb-1 flex items-center gap-2">
        <span className="text-body-md font-semibold text-on-background">{node.authorName}</span>
        <span className="text-label-md text-secondary">{node.time}</span>
        {node.isAdopted && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-label-md font-medium text-on-primary">
            <span className="material-symbols-outlined text-[14px] icon-fill">verified</span>
            已採納
          </span>
        )}
      </div>

      <div
        className="text-body-md leading-6 text-on-surface-variant"
        dangerouslySetInnerHTML={{ __html: node.contentHtml }}
      />

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
          <form action={adoptAnswer} className="inline">
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
          <form action={verifyAnswerAsTA} className="inline">
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
        <ReplyForm postId={postId} parentId={node.id} onDone={() => setReplying(false)} />
      )}

      {node.children.length > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-outline-variant/30 pl-4">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({
  nodes,
  postId,
  postAuthorId,
  currentUserId,
  currentUserRole,
  postSolved,
}: ThreadProps) {
  if (nodes.length === 0) {
    return <p className="text-body-md text-secondary">目前還沒有回覆，成為第一個解答的人吧！</p>;
  }
  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <CommentItem
          key={node.id}
          node={node}
          postId={postId}
          postAuthorId={postAuthorId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          postSolved={postSolved}
          depth={0}
        />
      ))}
    </div>
  );
}
