"use client";

import type { CommentNode } from "@/lib/comment-tree";

interface PlacedNode {
  id: string;
  label: string;
  fullLabel: string;
  x: number;
  y: number;
  adopted: boolean;
  isRoot: boolean;
  depth: number;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  adopted: boolean;
}

// 版面常數：節點為圓角卡片，連線改用平滑貝茲曲線。
const PAD_X = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;
const LEVEL_H = 92;
const LEAF_W = 92;
const NODE_W = 76;
const NODE_H = 38;
const NODE_RX = 12;

// 作者名截斷：保留可讀長度，過長補上省略號（完整名稱仍以 <title> 提供）。
function truncate(name: string, max = 6): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export default function CommentTreeSvg({
  nodes,
  rootLabel,
}: {
  nodes: CommentNode[];
  rootLabel: string;
}) {
  const placed: PlacedNode[] = [];
  const edges: Edge[] = [];
  let leafCounter = 0;
  let maxDepth = 0;

  type TreeLike = {
    id: string;
    authorName: string;
    isAdopted: boolean;
    children: TreeLike[];
  };

  const root: TreeLike = {
    id: "__root__",
    authorName: rootLabel,
    isAdopted: false,
    children: nodes,
  };

  function place(node: TreeLike, depth: number): { x: number; y: number } {
    maxDepth = Math.max(maxDepth, depth);
    const y = PAD_TOP + depth * LEVEL_H + NODE_H / 2;
    let x: number;

    if (node.children.length === 0) {
      x = PAD_X + leafCounter * LEAF_W + LEAF_W / 2;
      leafCounter += 1;
    } else {
      const childPos = node.children.map((c) => {
        const p = place(c, depth + 1);
        edges.push({ x1: 0, y1: y, x2: p.x, y2: p.y, adopted: c.isAdopted });
        return p;
      });
      x = (childPos[0].x + childPos[childPos.length - 1].x) / 2;
      // 補上本節點 x（edges 起點）
      for (let i = edges.length - childPos.length; i < edges.length; i++) {
        edges[i].x1 = x;
      }
    }

    placed.push({
      id: node.id,
      label: truncate(node.authorName),
      fullLabel: node.authorName,
      x,
      y,
      adopted: node.isAdopted,
      isRoot: node.id === "__root__",
      depth,
    });
    return { x, y };
  }

  place(root, 0);

  // 空狀態：尚無留言時不畫圖，給友善提示。
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest px-4 py-8 text-center dark:bg-surface-container">
        <span className="material-symbols-outlined text-[32px] text-outline" aria-hidden>
          account_tree
        </span>
        <p className="text-label-md text-secondary">
          目前還沒有留言，成為第一個解答的人，就會在這裡長出第一個節點。
        </p>
      </div>
    );
  }

  const width = Math.max(PAD_X * 2 + leafCounter * LEAF_W, 280);
  const height = PAD_TOP + maxDepth * LEVEL_H + NODE_H + PAD_BOTTOM;

  function focusComment(id: string) {
    if (id === "__root__") return;
    const el = document.getElementById(`comment-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
  }

  // 平滑連線：以垂直方向的三次貝茲曲線連接父子節點下/上緣。
  function edgePath(e: Edge): string {
    const startY = e.y1 + NODE_H / 2;
    const endY = e.y2 - NODE_H / 2;
    const midY = (startY + endY) / 2;
    return `M ${e.x1} ${startY} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${endY}`;
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container">
      {/* 圖例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-outline-variant/20 px-3 py-2 text-label-md text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-[4px] bg-primary" aria-hidden />
          提問
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-[4px] border border-outline-variant bg-surface-container-high" aria-hidden />
          回覆
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded-[4px] border border-primary bg-primary-container" aria-hidden />
          <span className="material-symbols-outlined text-[14px] text-primary icon-fill" aria-hidden>
            verified
          </span>
          已採納
        </span>
      </div>

      <div className="overflow-x-auto p-2">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block"
          role="img"
          aria-label={`留言樹狀結構視覺化，共 ${placed.length - 1} 則留言`}
        >
          {/* 連線（先畫，置於節點下方）；已採納路徑加粗高亮 */}
          {edges.map((e, i) => (
            <path
              key={i}
              d={edgePath(e)}
              fill="none"
              className={e.adopted ? "stroke-primary" : "stroke-outline-variant/70"}
              strokeWidth={e.adopted ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          ))}

          {placed.map((n) => {
            const interactive = !n.isRoot;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => focusComment(n.id)}
                onKeyDown={
                  interactive
                    ? (ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          focusComment(n.id);
                        }
                      }
                    : undefined
                }
                tabIndex={interactive ? 0 : undefined}
                role={interactive ? "button" : undefined}
                aria-label={
                  interactive
                    ? `跳至 ${n.fullLabel} 的留言${n.adopted ? "（已採納）" : ""}`
                    : undefined
                }
                className={
                  interactive
                    ? "cursor-pointer outline-none [&:focus-visible>rect]:stroke-primary [&:focus-visible>rect]:[stroke-width:2.5] [&:hover>rect]:opacity-90"
                    : ""
                }
              >
                <title>{n.fullLabel}</title>
                <rect
                  x={-NODE_W / 2}
                  y={-NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={NODE_RX}
                  ry={NODE_RX}
                  className={
                    n.isRoot
                      ? "fill-primary stroke-primary"
                      : n.adopted
                        ? "fill-primary-container stroke-primary"
                        : "fill-surface-container-high stroke-outline-variant"
                  }
                  strokeWidth={n.isRoot || n.adopted ? 1.75 : 1.25}
                />
                {/* 已採納節點：右上角打勾徽章 */}
                {n.adopted && !n.isRoot && (
                  <g transform={`translate(${NODE_W / 2 - 6}, ${-NODE_H / 2 + 6})`} aria-hidden>
                    <circle r={7} className="fill-primary" />
                    <path
                      d="M -3 0 L -1 2 L 3 -2.5"
                      fill="none"
                      className="stroke-on-primary"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`pointer-events-none select-none text-[11px] font-medium ${
                    n.isRoot
                      ? "fill-on-primary"
                      : n.adopted
                        ? "fill-on-primary-container"
                        : "fill-on-surface"
                  }`}
                >
                  {n.isRoot ? "提問" : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
