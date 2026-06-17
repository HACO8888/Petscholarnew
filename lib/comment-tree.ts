import type { Comment } from "@/db/schema";

export interface CommentNode {
  id: string;
  authorName: string;
  authorId: string | null;
  isAdopted: boolean;
  time: string;
  contentHtml: string;
  children: CommentNode[];
}

/**
 * 把扁平的 comment rows 依 parentId 組成樹狀結構（DFS 渲染用）。
 * renderHtml / fmtTime 由 server 端傳入，使節點為可序列化的純資料。
 */
export function buildCommentTree(
  rows: Comment[],
  renderHtml: (s: string) => string,
  fmtTime: (d: Date) => string,
): CommentNode[] {
  const sorted = [...rows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const map = new Map<string, CommentNode>();
  for (const r of sorted) {
    map.set(r.id, {
      id: r.id,
      authorName: r.authorName,
      authorId: r.authorId,
      isAdopted: r.isAdopted,
      time: fmtTime(r.createdAt),
      contentHtml: renderHtml(r.content),
      children: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const r of sorted) {
    const node = map.get(r.id)!;
    const parent = r.parentId ? map.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function countNodes(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
