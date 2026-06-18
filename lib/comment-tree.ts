import type { Comment } from "@/db/schema";

export interface CommentNode {
  id: string;
  authorName: string;
  authorId: string | null;
  isAdopted: boolean;
  hidden: boolean;
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
      hidden: r.hidden,
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

/**
 * 移除被隱藏（檢舉封鎖）的留言「整棵子樹」。
 * 直接以 hidden=false 過濾查詢會讓被隱藏父留言底下的可見回覆變成孤兒、被升級為頂層留言
 * （脫離脈絡、繞過審核）；故先以完整資料建樹，再連同子樹一起剪除被隱藏的節點。
 */
export function pruneHidden(nodes: CommentNode[]): CommentNode[] {
  return nodes
    .filter((n) => !n.hidden)
    .map((n) => ({ ...n, children: pruneHidden(n.children) }));
}

export function countNodes(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}
