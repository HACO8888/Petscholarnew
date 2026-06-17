"use client";

import type { CommentNode } from "@/lib/comment-tree";

interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  adopted: boolean;
  isRoot: boolean;
}

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  adopted: boolean;
}

const PAD = 28;
const LEVEL_H = 78;
const LEAF_W = 76;

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
    const y = PAD + depth * LEVEL_H;
    let x: number;

    if (node.children.length === 0) {
      x = PAD + leafCounter * LEAF_W + LEAF_W / 2;
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
      label: node.authorName,
      x,
      y,
      adopted: node.isAdopted,
      isRoot: node.id === "__root__",
    });
    return { x, y };
  }

  place(root, 0);

  const width = Math.max(PAD * 2 + leafCounter * LEAF_W, 320);
  const height = PAD * 2 + maxDepth * LEVEL_H + 24;

  function focusComment(id: string) {
    if (id === "__root__") return;
    const el = document.getElementById(`comment-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2 dark:bg-surface-container">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto"
        role="img"
        aria-label="留言樹狀結構視覺化"
      >
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            className={e.adopted ? "stroke-primary" : "stroke-outline-variant"}
            strokeWidth={e.adopted ? 2.5 : 1.5}
          />
        ))}
        {placed.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onClick={() => focusComment(n.id)}
            className={n.isRoot ? "" : "cursor-pointer"}
          >
            <ellipse
              rx={28}
              ry={17}
              className={
                n.isRoot
                  ? "fill-primary stroke-primary"
                  : n.adopted
                    ? "fill-primary-container stroke-primary"
                    : "fill-surface-container-high stroke-outline-variant"
              }
              strokeWidth={1.5}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              className={`pointer-events-none text-[10px] ${n.isRoot ? "fill-on-primary" : "fill-on-surface"}`}
            >
              {n.label.slice(0, 4)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
