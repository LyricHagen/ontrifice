"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type MutableRefObject,
} from "react";
import * as d3 from "d3";
import type { MarketNode, GraphEdge, GraphMode } from "./types";
import { getEdgeStyle, NODE_COLORS, LEGEND_ENTRIES } from "./types";

interface SimNode extends MarketNode {
  x: number;
  y: number;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relationClass: string;
  relationType: string;
  score: number;
  confidence: number;
  direction: string;
  evidence?: Record<string, unknown> | null;
}

interface GraphCanvasProps {
  markets: MarketNode[];
  edges: GraphEdge[];
  mode: GraphMode;
  focalNodeId: string | null;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodeClick: (id: string) => void;
  onEdgeClick: (edgeId: string) => void;
  onExpandNode: (id: string) => void;
  centerOnNodeRef?: MutableRefObject<((id: string) => void) | null>;
}

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return (
    (document.documentElement.getAttribute("data-theme") as
      | "dark"
      | "light") ?? "dark"
  );
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - size * Math.cos(angle - Math.PI / 7),
    y2 - size * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    x2 - size * Math.cos(angle + Math.PI / 7),
    y2 - size * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
}

const EXPAND_RADIUS = 6;
const EXPAND_OFFSET = 2;

function getExpandCenter(
  node: SimNode,
  scale: number,
): { x: number; y: number } {
  const offset = node.radius + EXPAND_OFFSET + EXPAND_RADIUS / scale;
  return { x: node.x + offset * 0.7, y: node.y - offset * 0.7 };
}

export function GraphCanvas({
  markets,
  edges,
  mode,
  focalNodeId,
  expandedNodes,
  selectedNodeId,
  selectedEdgeId,
  onNodeClick,
  onEdgeClick,
  onExpandNode,
  centerOnNodeRef,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const hoveredEdgeRef = useRef<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(
    null,
  );
  const d3CanvasRef = useRef<d3.Selection<
    HTMLCanvasElement,
    unknown,
    null,
    undefined
  > | null>(null);
  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<SimNode | null>(null);

  const [layoutDone, setLayoutDone] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const transform = transformRef.current;
    const theme = getTheme();
    const isDark = theme === "dark";
    const bgColor = isDark ? "#0a0a0a" : "#ffffff";
    const totalVisible = nodesRef.current.length;
    const showLabelsAlways = totalVisible < 30;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hoveredId = hoveredRef.current;
    const hovEdgeId = hoveredEdgeRef.current;
    const connectedToHovered = new Set<string>();
    const hoveredEdgeIds = new Set<string>();
    if (hoveredId) {
      for (const link of linksRef.current) {
        const src = (link.source as SimNode).id;
        const tgt = (link.target as SimNode).id;
        if (src === hoveredId || tgt === hoveredId) {
          connectedToHovered.add(src);
          connectedToHovered.add(tgt);
          hoveredEdgeIds.add(link.id);
        }
      }
    }

    // --- Draw edges ---
    for (const link of linksRef.current) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      const style = getEdgeStyle(link.relationType, link.evidence);
      const baseColor = isDark ? style.color : style.colorLight;
      let opacity = 0.7;

      if (hoveredId) {
        opacity = hoveredEdgeIds.has(link.id) ? 0.9 : 0.08;
      }
      if (hovEdgeId) {
        opacity = link.id === hovEdgeId ? 1 : 0.08;
      }
      if (selectedEdgeId) {
        opacity = link.id === selectedEdgeId ? 1 : 0.15;
      }
      if (selectedNodeId && !hovEdgeId && !hoveredId) {
        const src = source.id;
        const tgt = target.id;
        if (src === selectedNodeId || tgt === selectedNodeId) {
          opacity = 0.9;
        } else {
          opacity = 0.12;
        }
      }

      const lineWidth = style.width / transform.k;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const startX = source.x + (dx / dist) * source.radius;
      const startY = source.y + (dy / dist) * source.radius;
      const endX = target.x - (dx / dist) * target.radius;
      const endY = target.y - (dy / dist) * target.radius;

      const unit = 1 / transform.k;
      ctx.setLineDash(style.dash.map((d) => d * unit));
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      if (style.directed) {
        ctx.fillStyle = baseColor;
        drawArrowhead(ctx, startX, startY, endX, endY, 6 / transform.k);
      }

      ctx.globalAlpha = 1;
    }

    ctx.setLineDash([]);

    // --- Draw nodes ---
    for (const node of nodesRef.current) {
      const platformColors =
        NODE_COLORS[node.platform] ?? NODE_COLORS.polymarket;
      const fillColor = isDark ? platformColors.fill : platformColors.fillLight;
      const strokeColor = isDark
        ? platformColors.stroke
        : platformColors.strokeLight;
      let alpha = 1;
      const isFocal = node.id === focalNodeId;
      const nodeRadius = isFocal ? Math.max(node.radius, 10) : node.radius;

      if (
        hoveredId &&
        hoveredId !== node.id &&
        !connectedToHovered.has(node.id)
      ) {
        alpha = 0.1;
      }
      if (hovEdgeId && !hoveredId) {
        const hovLink = linksRef.current.find((l) => l.id === hovEdgeId);
        if (hovLink) {
          const src = (hovLink.source as SimNode).id;
          const tgt = (hovLink.target as SimNode).id;
          alpha = node.id === src || node.id === tgt ? 1 : 0.1;
        }
      }
      if (selectedNodeId && selectedNodeId !== node.id && !hoveredId && !hovEdgeId) {
        let isConnected = false;
        for (const link of linksRef.current) {
          const src = (link.source as SimNode).id;
          const tgt = (link.target as SimNode).id;
          if (
            (src === selectedNodeId && tgt === node.id) ||
            (tgt === selectedNodeId && src === node.id)
          ) {
            isConnected = true;
            break;
          }
        }
        if (!isConnected) alpha = 0.15;
      }

      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1 / transform.k;
      ctx.stroke();

      if (node.id === selectedNodeId) {
        ctx.strokeStyle = "#4a7cff";
        ctx.lineWidth = 2 / transform.k;
        ctx.beginPath();
        ctx.arc(
          node.x,
          node.y,
          nodeRadius + 3 / transform.k,
          0,
          2 * Math.PI,
        );
        ctx.stroke();
      }

      if (node.id === hoveredId) {
        ctx.strokeStyle = isDark ? "#ffffff" : "#000000";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.beginPath();
        ctx.arc(
          node.x,
          node.y,
          nodeRadius + 1 / transform.k,
          0,
          2 * Math.PI,
        );
        ctx.stroke();
      }

      // --- Expand button ---
      if (
        mode === "ego" &&
        !isFocal &&
        !expandedNodes.has(node.id) &&
        alpha > 0.5
      ) {
        const ec = getExpandCenter(node, transform.k);
        const er = EXPAND_RADIUS / transform.k;
        ctx.beginPath();
        ctx.arc(ec.x, ec.y, er, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? "#1a1a1a" : "#f0f0f0";
        ctx.fill();
        ctx.strokeStyle = isDark
          ? "rgba(255,255,255,0.3)"
          : "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1 / transform.k;
        ctx.stroke();

        const plusSize = 3 / transform.k;
        ctx.beginPath();
        ctx.moveTo(ec.x - plusSize, ec.y);
        ctx.lineTo(ec.x + plusSize, ec.y);
        ctx.moveTo(ec.x, ec.y - plusSize);
        ctx.lineTo(ec.x, ec.y + plusSize);
        ctx.strokeStyle = isDark
          ? "rgba(255,255,255,0.6)"
          : "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1.2 / transform.k;
        ctx.stroke();
      }

      // --- Label ---
      const shouldShowLabel =
        showLabelsAlways ||
        node.id === hoveredId ||
        node.id === selectedNodeId ||
        isFocal;
      if (shouldShowLabel) {
        const label =
          node.title.length > 40
            ? node.title.slice(0, 40) + "..."
            : node.title;
        const fontSize = Math.max(
          8,
          Math.min(isFocal ? 12 : 11, 12 / transform.k),
        );
        ctx.font = `${isFocal ? "600 " : ""}${fontSize}px var(--font-ibm-plex-sans), sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textY = node.y + nodeRadius + 4 / transform.k;

        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 3 / transform.k;
        ctx.lineJoin = "round";
        ctx.strokeText(label, node.x, textY);

        ctx.fillStyle = isDark ? "#999999" : "#666666";
        if (
          node.id === hoveredId ||
          node.id === selectedNodeId ||
          isFocal
        ) {
          ctx.fillStyle = isDark ? "#e5e5e5" : "#1a1a1a";
        }
        ctx.fillText(label, node.x, textY);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // --- Legend (screen space) ---
    const canvasH = canvas.height / dpr;
    const legendX = 16;
    let legendY = canvasH - 16 - LEGEND_ENTRIES.length * 18;
    const textColor = isDark ? "#999999" : "#666666";

    ctx.save();

    for (const entry of LEGEND_ENTRIES) {
      const style = getEdgeStyle(entry.relationType, entry.evidence);
      const color = isDark ? style.color : style.colorLight;
      const lineStartX = legendX;
      const lineEndX = legendX + 28;
      const lineY = legendY + 6;

      ctx.setLineDash(style.dash);
      ctx.beginPath();
      ctx.moveTo(lineStartX, lineY);
      ctx.lineTo(lineEndX, lineY);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = style.width;
      ctx.stroke();

      if (style.directed) {
        ctx.fillStyle = color;
        drawArrowhead(ctx, lineStartX, lineY, lineEndX, lineY, 5);
      }

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.font =
        "10px var(--font-ibm-plex-sans), sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = textColor;
      ctx.fillText(entry.label, legendX + 34, lineY);

      legendY += 18;
    }

    // Platform colors
    legendY += 4;
    const platforms = [
      { key: "polymarket", label: "Polymarket" },
      { key: "kalshi", label: "Kalshi" },
    ];
    for (const p of platforms) {
      const colors = NODE_COLORS[p.key];
      const fc = isDark ? colors.fill : colors.fillLight;
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY + 5, 4, 0, 2 * Math.PI);
      ctx.fillStyle = fc;
      ctx.fill();
      ctx.font =
        "10px var(--font-ibm-plex-sans), sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = textColor;
      ctx.fillText(p.label, legendX + 14, legendY + 5);
      legendY += 16;
    }

    ctx.restore();
  }, [
    selectedNodeId,
    selectedEdgeId,
    focalNodeId,
    expandedNodes,
    mode,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || markets.length === 0) {
      setLayoutDone(true);
      return;
    }

    setLayoutDone(false);

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const prevPos = prevPositionsRef.current;
    const nodeMap = new Map<string, SimNode>();
    const nodes: SimNode[] = markets.map((m) => {
      const vol = m.volumeUsd ? parseFloat(m.volumeUsd) : 0;
      const radius = Math.max(
        4,
        Math.min(14, 4 + Math.log10(Math.max(1, vol)) * 1.5),
      );
      const prev = prevPos.get(m.id);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const node: SimNode = {
        ...m,
        x: prev?.x ?? cx + (Math.random() - 0.5) * 200,
        y: prev?.y ?? cy + (Math.random() - 0.5) * 200,
        radius,
      };
      if (m.id === focalNodeId && !prev) {
        node.x = cx;
        node.y = cy;
        node.fx = cx;
        node.fy = cy;
      } else if (prev && m.fx != null) {
        node.fx = prev.x;
        node.fy = prev.y;
      }
      nodeMap.set(m.id, node);
      return node;
    });

    const links: SimLink[] = edges
      .filter(
        (e) =>
          nodeMap.has(e.sourceMarketId) && nodeMap.has(e.targetMarketId),
      )
      .map((e) => ({
        source: nodeMap.get(e.sourceMarketId)!,
        target: nodeMap.get(e.targetMarketId)!,
        id: e.id,
        relationClass: e.relationClass,
        relationType: e.relationType,
        score: parseFloat(e.score),
        confidence: parseFloat(e.confidence),
        direction: e.direction,
        evidence: e.evidence,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const isEgo = mode === "ego";
    const chargeStrength = isEgo ? -400 : -150;
    const linkDist = isEgo ? 150 : 200;

    // Clustering force for browse mode
    let clusters: Map<string, Set<string>> | undefined;
    if (mode === "browse") {
      clusters = new Map();
      const adj = new Map<string, Set<string>>();
      for (const node of nodes) adj.set(node.id, new Set());
      for (const link of links) {
        const s = (link.source as SimNode).id;
        const t = (link.target as SimNode).id;
        adj.get(s)?.add(t);
        adj.get(t)?.add(s);
      }
      const visited = new Set<string>();
      let clusterId = 0;
      for (const node of nodes) {
        if (visited.has(node.id)) continue;
        const component = new Set<string>();
        const queue = [node.id];
        visited.add(node.id);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          component.add(curr);
          for (const neighbor of adj.get(curr) ?? []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        if (component.size > 1) {
          clusters.set(String(clusterId++), component);
        }
      }
    }

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(linkDist)
          .strength((d) => Math.min(1, Math.abs(d.score) * 0.6 + 0.1)),
      )
      .force(
        "charge",
        d3.forceManyBody().strength(chargeStrength).distanceMax(600),
      )
      .force("center", d3.forceCenter(cx, cy).strength(0.05))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => d.radius + 4),
      )
      .alphaDecay(0.03)
      .stop();

    if (clusters && clusters.size > 0) {
      simulation.force("cluster", () => {
        for (const [, members] of clusters!) {
          if (members.size < 2) continue;
          let avgX = 0;
          let avgY = 0;
          let count = 0;
          for (const id of members) {
            const n = nodeMap.get(id);
            if (n) {
              avgX += n.x;
              avgY += n.y;
              count++;
            }
          }
          if (count === 0) continue;
          avgX /= count;
          avgY /= count;
          for (const id of members) {
            const n = nodeMap.get(id);
            if (n && n.fx == null) {
              n.x += (avgX - n.x) * 0.008;
              n.y += (avgY - n.y) * 0.008;
            }
          }
        }
      });
    }

    simulationRef.current = simulation;

    const tickCount = prevPos.size > 0 ? 80 : 200;
    let ticksDone = 0;
    const chunkSize = 20;

    function tickChunk() {
      const end = Math.min(ticksDone + chunkSize, tickCount);
      for (let i = ticksDone; i < end; i++) simulation.tick();
      ticksDone = end;

      if (ticksDone < tickCount) {
        requestAnimationFrame(tickChunk);
      } else {
        setLayoutDone(true);
        simulation.on("tick", () => {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(draw);
        });
        simulation.alpha(0.05).restart();
        draw();
        setupInteraction();
      }
    }
    requestAnimationFrame(tickChunk);

    // Zoom
    const d3CanvasSel = d3.select(canvas);
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .filter((event: Event) => {
        const e = event as MouseEvent;
        if (e.button) return false;
        if (
          e.type === "mousedown" ||
          e.type === "pointerdown"
        ) {
          const r = canvas.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          if (getNodeAtPoint(x, y)) return false;
        }
        return true;
      })
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      });

    d3CanvasSel.call(zoom);
    d3CanvasSel.on("dblclick.zoom", null);
    zoomRef.current = zoom;
    d3CanvasRef.current = d3CanvasSel;

    if (centerOnNodeRef) {
      centerOnNodeRef.current = (id: string) => {
        const node = nodesRef.current.find((n) => n.id === id);
        if (!node) return;
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        const scale = 1.8;
        const tx = w / 2 - node.x * scale;
        const ty = h / 2 - node.y * scale;
        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3CanvasSel
          .transition()
          .duration(500)
          .call(zoom.transform, t);
      };
    }

    // Hit detection
    function getNodeAtPoint(px: number, py: number): SimNode | null {
      const t = transformRef.current;
      const mx = (px - t.x) / t.k;
      const my = (py - t.y) / t.k;
      const threshold = 8 / t.k;

      let closest: SimNode | null = null;
      let closestDist = Infinity;

      for (const node of nodesRef.current) {
        const isFocal = node.id === focalNodeId;
        const r = isFocal ? Math.max(node.radius, 10) : node.radius;
        const dx = node.x - mx;
        const dy = node.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r + threshold && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      return closest;
    }

    function getExpandAtPoint(px: number, py: number): SimNode | null {
      if (mode !== "ego") return null;
      const t = transformRef.current;
      const mx = (px - t.x) / t.k;
      const my = (py - t.y) / t.k;
      const threshold = EXPAND_RADIUS / t.k + 2 / t.k;

      for (const node of nodesRef.current) {
        if (node.id === focalNodeId || expandedNodes.has(node.id)) continue;
        const ec = getExpandCenter(node, t.k);
        const dx = ec.x - mx;
        const dy = ec.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) return node;
      }
      return null;
    }

    function getEdgeAtPoint(px: number, py: number): SimLink | null {
      const t = transformRef.current;
      const mx = (px - t.x) / t.k;
      const my = (py - t.y) / t.k;
      const threshold = 6 / t.k;

      let closest: SimLink | null = null;
      let closestDist = Infinity;

      for (const link of linksRef.current) {
        const source = link.source as SimNode;
        const target = link.target as SimNode;
        const dist = distToSegment(
          mx,
          my,
          source.x,
          source.y,
          target.x,
          target.y,
        );
        if (dist < threshold && dist < closestDist) {
          closest = link;
          closestDist = dist;
        }
      }
      return closest;
    }

    // Interaction handlers
    let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    let mouseDownHandler: ((e: MouseEvent) => void) | null = null;
    let mouseUpHandler: ((e: MouseEvent) => void) | null = null;
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let dblClickHandler: ((e: MouseEvent) => void) | null = null;
    let mouseLeaveHandler: (() => void) | null = null;

    function setupInteraction() {
      if (!canvas) return;

      mouseDownHandler = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const node = getNodeAtPoint(x, y);
        if (node && !getExpandAtPoint(x, y)) {
          isDraggingRef.current = true;
          draggedNodeRef.current = node;
          node.fx = node.x;
          node.fy = node.y;
          simulationRef.current?.alphaTarget(0.1).restart();
        }
      };

      mouseMoveHandler = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        if (isDraggingRef.current && draggedNodeRef.current) {
          const t = transformRef.current;
          draggedNodeRef.current.fx = (x - t.x) / t.k;
          draggedNodeRef.current.fy = (y - t.y) / t.k;
          return;
        }

        const expandNode = getExpandAtPoint(x, y);
        const node = getNodeAtPoint(x, y);

        const prevHov = hoveredRef.current;
        const prevEdge = hoveredEdgeRef.current;

        if (expandNode) {
          hoveredRef.current = null;
          hoveredEdgeRef.current = null;
          canvas.style.cursor = "pointer";
        } else if (node) {
          hoveredRef.current = node.id;
          hoveredEdgeRef.current = null;
          canvas.style.cursor = "pointer";
        } else {
          hoveredRef.current = null;
          const edge = getEdgeAtPoint(x, y);
          hoveredEdgeRef.current = edge?.id ?? null;
          canvas.style.cursor = edge ? "pointer" : "grab";
        }

        if (
          prevHov !== hoveredRef.current ||
          prevEdge !== hoveredEdgeRef.current
        ) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(draw);
        }

        // Tooltip
        const tooltip = tooltipRef.current;
        if (!tooltip || !containerRef.current) return;

        if (node && !expandNode) {
          const prob = node.currentProbability
            ? `${(parseFloat(node.currentProbability) * 100).toFixed(1)}%`
            : "--";
          const vol = node.volumeUsd
            ? `$${parseFloat(node.volumeUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : "--";
          tooltip.innerHTML =
            `<div class="font-sans text-xs" style="max-width:280px">` +
            `<div class="font-semibold" style="word-break:break-word">${node.title}</div>` +
            `<div class="text-text-secondary mt-1">${node.platform} &middot; ${prob} &middot; ${vol}</div>` +
            `</div>`;
          tooltip.style.display = "block";
        } else if (hoveredEdgeRef.current) {
          const link = linksRef.current.find(
            (l) => l.id === hoveredEdgeRef.current,
          );
          if (link) {
            const src = link.source as SimNode;
            const tgt = link.target as SimNode;
            const style = getEdgeStyle(link.relationType, link.evidence);
            tooltip.innerHTML =
              `<div class="font-sans text-xs" style="max-width:300px">` +
              `<div class="font-semibold">${style.label}</div>` +
              `<div class="text-text-secondary mt-1">confidence: ${link.confidence.toFixed(3)}</div>` +
              `<div class="text-text-secondary mt-1" style="word-break:break-word;font-size:10px">${src.title.slice(0, 50)} &harr; ${tgt.title.slice(0, 50)}</div>` +
              `</div>`;
            tooltip.style.display = "block";
          }
        } else {
          tooltip.style.display = "none";
        }

        if (tooltip.style.display !== "none") {
          const cRect = containerRef.current.getBoundingClientRect();
          const tipRect = tooltip.getBoundingClientRect();
          let tipX = e.clientX - cRect.left + 12;
          let tipY = e.clientY - cRect.top - 10;
          if (tipX + tipRect.width > cRect.width) {
            tipX = e.clientX - cRect.left - tipRect.width - 12;
          }
          if (tipY < 0) tipY = e.clientY - cRect.top + 20;
          tooltip.style.left = `${tipX}px`;
          tooltip.style.top = `${tipY}px`;
        }
      };

      mouseUpHandler = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          draggedNodeRef.current = null;
          simulationRef.current?.alphaTarget(0);
        }
      };

      clickHandler = (e: MouseEvent) => {
        if (isDraggingRef.current) return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        const expandNode = getExpandAtPoint(x, y);
        if (expandNode) {
          onExpandNode(expandNode.id);
          return;
        }

        const node = getNodeAtPoint(x, y);
        if (node) {
          onNodeClick(node.id);
          return;
        }

        const edge = getEdgeAtPoint(x, y);
        if (edge) {
          onEdgeClick(edge.id);
        }
      };

      dblClickHandler = (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const node = getNodeAtPoint(x, y);
        if (!node) {
          d3CanvasSel
            .transition()
            .duration(400)
            .call(zoom.transform, d3.zoomIdentity);
        }
      };

      mouseLeaveHandler = () => {
        hoveredRef.current = null;
        hoveredEdgeRef.current = null;
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      };

      canvas.addEventListener("mousedown", mouseDownHandler);
      canvas.addEventListener("mousemove", mouseMoveHandler);
      canvas.addEventListener("mouseup", mouseUpHandler);
      canvas.addEventListener("click", clickHandler);
      canvas.addEventListener("dblclick", dblClickHandler);
      canvas.addEventListener("mouseleave", mouseLeaveHandler);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        simulation.force(
          "center",
          d3.forceCenter(width / 2, height / 2).strength(0.05),
        );
        simulation.alpha(0.1).restart();
      }
    });
    resizeObserver.observe(container);

    return () => {
      // Save positions for next render
      const posMap = new Map<string, { x: number; y: number }>();
      for (const n of nodesRef.current) {
        posMap.set(n.id, { x: n.x, y: n.y });
      }
      prevPositionsRef.current = posMap;

      simulation.stop();
      cancelAnimationFrame(rafRef.current);
      if (mouseMoveHandler)
        canvas.removeEventListener("mousemove", mouseMoveHandler);
      if (mouseDownHandler)
        canvas.removeEventListener("mousedown", mouseDownHandler);
      if (mouseUpHandler)
        canvas.removeEventListener("mouseup", mouseUpHandler);
      if (clickHandler) canvas.removeEventListener("click", clickHandler);
      if (dblClickHandler)
        canvas.removeEventListener("dblclick", dblClickHandler);
      if (mouseLeaveHandler)
        canvas.removeEventListener("mouseleave", mouseLeaveHandler);
      resizeObserver.disconnect();
    };
  }, [
    markets,
    edges,
    mode,
    focalNodeId,
    expandedNodes,
    draw,
    onNodeClick,
    onEdgeClick,
    onExpandNode,
    centerOnNodeRef,
  ]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [selectedNodeId, selectedEdgeId, draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        role="img"
        aria-label="Constraint graph visualization. Scroll to zoom, drag to pan, click nodes or edges for details."
      />
      {!layoutDone && markets.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="font-mono text-sm text-text-secondary">
            Computing layout...
          </span>
        </div>
      )}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-surface border border-border px-2 py-1.5"
        style={{ display: "none", borderRadius: "2px", zIndex: 10 }}
      />
    </div>
  );
}
