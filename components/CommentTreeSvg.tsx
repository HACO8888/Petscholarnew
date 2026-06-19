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

// 版面常數：節點為圓角卡片，連線以垂直方向的三次貝茲曲線連接父子。
const PAD_X = 24; // 左右內距
const PAD_TOP = 20; // 上方內距
const PAD_BOTTOM = 24; // 下方內距
const LEVEL_H = 92; // 每層垂直間距（節點中心到中心）
const NODE_W = 76; // 節點卡片寬
const NODE_H = 38; // 節點卡片高
const NODE_RX = 12; // 節點圓角
const H_GAP = 16; // 同層相鄰子樹之間的最小水平間隙
const SLOT_W = NODE_W + H_GAP; // 單一節點佔用的水平寬度（含間隙）

// 作者名截斷：保留可讀長度，過長補上省略號（完整名稱仍以 <title> 提供）。
function truncate(name: string, max = 6): string {
  const trimmed = name.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

type TreeLike = {
  id: string;
  authorName: string;
  isAdopted: boolean;
  children: TreeLike[];
};

// 每個節點先算出「子樹寬度」：葉節點佔一格，內部節點佔其所有子樹寬度之和。
// 這保證任意深度/寬度的子樹都不會互相重疊（tidy-tree 的水平空間配置）。
function subtreeWidth(node: TreeLike, widths: Map<string, number>): number {
  if (node.children.length === 0) {
    widths.set(node.id, SLOT_W);
    return SLOT_W;
  }
  const total = node.children.reduce(
    (sum, c) => sum + subtreeWidth(c, widths),
    0,
  );
  // 內部節點本身至少要有一格寬，避免單一窄子樹讓父節點被擠到與兄弟重疊。
  const w = Math.max(total, SLOT_W);
  widths.set(node.id, w);
  return w;
}

export default function CommentTreeSvg({
  nodes,
  rootLabel,
}: {
  nodes: CommentNode[];
  rootLabel: string;
}) {
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

  const placed: PlacedNode[] = [];
  const edges: Edge[] = [];
  let maxDepth = 0;

  const root: TreeLike = {
    id: "__root__",
    authorName: rootLabel,
    isAdopted: false,
    children: nodes,
  };

  // Pass 1：算出每棵子樹的水平寬度。
  const widths = new Map<string, number>();
  subtreeWidth(root, widths);

  // Pass 2：以 [left, left+width) 的水平帶狀區間配置每個子樹，
  // 節點置於其子節點群（子帶）的水平中點；葉節點置於自身帶的中點。
  function place(node: TreeLike, depth: number, left: number): PlacedNode {
    maxDepth = Math.max(maxDepth, depth);
    const y = PAD_TOP + depth * LEVEL_H + NODE_H / 2;
    const width = widths.get(node.id)!;

    let x: number;
    const childPlacements: PlacedNode[] = [];

    if (node.children.length === 0) {
      // 葉節點：置於自身水平帶中點。
      x = left + width / 2;
    } else {
      // 內部節點：依序把子樹排進連續的水平帶。
      let cursor = left;
      // 若子樹總寬小於本節點最小寬（被 SLOT_W 撐大），置中其子群於本帶。
      const childrenTotal = node.children.reduce(
        (sum, c) => sum + widths.get(c.id)!,
        0,
      );
      cursor += Math.max(0, (width - childrenTotal) / 2);

      for (const c of node.children) {
        const cw = widths.get(c.id)!;
        childPlacements.push(place(c, depth + 1, cursor));
        cursor += cw;
      }
      // 父節點水平置中於「第一個子」與「最後一個子」的中心之間。
      const first = childPlacements[0];
      const last = childPlacements[childPlacements.length - 1];
      x = (first.x + last.x) / 2;
    }

    const self: PlacedNode = {
      id: node.id,
      label: truncate(node.authorName),
      fullLabel: node.authorName,
      x,
      y,
      adopted: node.isAdopted,
      isRoot: node.id === "__root__",
      depth,
    };
    placed.push(self);

    // 連線：父節點下緣 → 子節點上緣（x 在父節點確定後才能對準，故於此推入）。
    for (const c of childPlacements) {
      edges.push({ x1: x, y1: y, x2: c.x, y2: c.y, adopted: c.adopted });
    }

    return self;
  }

  place(root, 0, PAD_X);

  // SVG 尺寸：完整涵蓋所有節點（含卡片半寬）與內距。
  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of placed) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    maxX = Math.max(maxX, n.x + NODE_W / 2);
  }
  const contentRight = maxX + PAD_X;
  const width = Math.max(contentRight, 280);
  const height = PAD_TOP + maxDepth * LEVEL_H + NODE_H + PAD_BOTTOM;

  function focusComment(id: string) {
    if (id === "__root__") return;
    const el = document.getElementById(`comment-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
  }

  // 平滑連線：以垂直方向的三次貝茲曲線連接父節點下緣與子節點上緣。
  function edgePath(e: Edge): string {
    const startY = e.y1 + NODE_H / 2;
    const endY = e.y2 - NODE_H / 2;
    const midY = (startY + endY) / 2;
    return `M ${e.x1} ${startY} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${endY}`;
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container">
      {/* 圖例：色塊與實際節點填色一致（提問=primary、回覆=一般卡片、已採納=primary-container + 打勾） */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-outline-variant/20 px-3 py-2 text-label-md text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-5 rounded-md bg-primary"
            aria-hidden
          />
          提問
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-5 rounded-md border border-outline-variant bg-surface-container-high"
            aria-hidden
          />
          回覆
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="relative inline-flex h-4 w-5 items-center justify-center rounded-md border border-primary bg-primary-container"
            aria-hidden
          >
            <span className="material-symbols-outlined text-[12px] leading-none text-primary icon-fill">
              check
            </span>
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
