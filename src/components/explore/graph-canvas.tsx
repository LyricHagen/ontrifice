"use client";

import { useRef, useEffect, useCallback, type MutableRefObject } from "react";
import * as d3 from "d3";
import type { MarketNode, GraphEdge, PLATFORM_COLORS, RELATION_CLASS_COLORS } from "./types";

interface SimNode extends MarketNode {
  x: number;
  y: number;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relationClass: string;
  relationType: string;
  score: number;
  direction: string;
  id: string;
  sampleSize: number | null;
}

interface GraphCanvasProps {
  markets: MarketNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  selectedEdgeId: string | null;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null) => void;
  onEdgeClick: (edgeId: string) => void;
  platformColors: typeof PLATFORM_COLORS;
  relationClassColors: typeof RELATION_CLASS_COLORS;
  centerOnNodeRef?: MutableRefObject<((id: string) => void) | null>;
}

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
}

function classLabel(rc: string): string {
  if (rc === "logical") return "LOGICAL";
  if (rc === "statistical") return "STATISTICAL";
  return "SEMANTIC";
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
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

function setDashForClass(ctx: CanvasRenderingContext2D, rc: string, scale: number) {
  const unit = 1 / scale;
  if (rc === "logical") {
    ctx.setLineDash([]);
  } else if (rc === "statistical") {
    ctx.setLineDash([6 * unit, 4 * unit]);
  } else {
    ctx.setLineDash([2 * unit, 3 * unit]);
  }
}

export function GraphCanvas({
  markets,
  edges,
  selectedId,
  selectedEdgeId,
  onNodeClick,
  onNodeHover,
  onEdgeClick,
  platformColors,
  relationClassColors,
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
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const d3CanvasRef = useRef<d3.Selection<HTMLCanvasElement, unknown, null, undefined> | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const transform = transformRef.current;
    const theme = getTheme();
    const isDark = theme === "dark";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hoveredId = hoveredRef.current;
    const hovEdgeId = hoveredEdgeRef.current;
    const connectedToHovered = new Set<string>();
    const hoveredEdges = new Set<string>();
    if (hoveredId) {
      for (const link of linksRef.current) {
        const src = (link.source as SimNode).id;
        const tgt = (link.target as SimNode).id;
        if (src === hoveredId || tgt === hoveredId) {
          connectedToHovered.add(src);
          connectedToHovered.add(tgt);
          hoveredEdges.add(link.id);
        }
      }
    }

    for (const link of linksRef.current) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      const colors = relationClassColors[link.relationClass] ?? relationClassColors.semantic;
      const baseColor = isDark ? colors.dark : colors.light;
      let opacity = colors.opacity * Math.abs(link.score);

      if (hoveredId) {
        opacity = hoveredEdges.has(link.id) ? Math.max(opacity, 0.6) : opacity * 0.15;
      }
      if (hovEdgeId) {
        opacity = link.id === hovEdgeId ? Math.max(opacity, 0.8) : opacity * 0.15;
      }
      if (selectedEdgeId) {
        opacity = link.id === selectedEdgeId ? Math.max(opacity, 0.8) : opacity * 0.2;
      }
      if (selectedId && !hovEdgeId) {
        const src = source.id;
        const tgt = target.id;
        if (src === selectedId || tgt === selectedId) {
          opacity = Math.max(opacity, 0.6);
        } else if (!hoveredId) {
          opacity *= 0.3;
        }
      }

      const lineWidth = (link.id === hovEdgeId || link.id === selectedEdgeId) ? 2 / transform.k : 1 / transform.k;

      setDashForClass(ctx, link.relationClass, transform.k);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.setLineDash([]);

    const zoomLevel = transform.k;
    const showLabels = zoomLevel > 1.5;

    for (const node of nodesRef.current) {
      const color = platformColors[node.platform] ?? "#7c7c7c";
      let alpha = 1;

      if (hoveredId && hoveredId !== node.id && !connectedToHovered.has(node.id)) {
        alpha = 0.15;
      }
      if (hovEdgeId && !hoveredId) {
        const hovLink = linksRef.current.find((l) => l.id === hovEdgeId);
        if (hovLink) {
          const src = (hovLink.source as SimNode).id;
          const tgt = (hovLink.target as SimNode).id;
          alpha = (node.id === src || node.id === tgt) ? 1 : 0.15;
        }
      }
      if (selectedId && selectedId !== node.id && !hoveredId && !hovEdgeId) {
        let isConnected = false;
        for (const link of linksRef.current) {
          const src = (link.source as SimNode).id;
          const tgt = (link.target as SimNode).id;
          if (
            (src === selectedId && tgt === node.id) ||
            (tgt === selectedId && src === node.id)
          ) {
            isConnected = true;
            break;
          }
        }
        if (!isConnected) alpha = 0.2;
      }

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (node.id === hoveredId || node.id === selectedId) {
        ctx.strokeStyle = isDark ? "#ffffff" : "#000000";
        ctx.lineWidth = 1.5 / transform.k;
        ctx.stroke();
      }

      if (showLabels) {
        const label =
          node.title.length > 40 ? node.title.slice(0, 40) + "..." : node.title;
        const fontSize = Math.max(10 / transform.k, 8);
        ctx.font = `${fontSize}px var(--font-jetbrains-mono), monospace`;
        ctx.fillStyle = isDark ? "#e5e5e5" : "#0a0a0a";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, node.x, node.y + node.radius + 3 / transform.k);
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Legend
    const legendX = 16;
    const legendY = canvas.height / dpr - 80;
    const legendColor = isDark ? "#e5e5e5" : "#0a0a0a";
    const legendBg = isDark ? "rgba(10,10,10,0.85)" : "rgba(255,255,255,0.85)";
    const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

    ctx.save();
    ctx.fillStyle = legendBg;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(legendX, legendY, 200, 68);
    ctx.fill();
    ctx.stroke();

    ctx.font = "11px var(--font-jetbrains-mono), monospace";
    ctx.fillStyle = legendColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const lineY1 = legendY + 14;
    const lineY2 = legendY + 28;
    const lineY3 = legendY + 42;
    const textX = legendX + 40;
    const lineStartX = legendX + 8;
    const lineEndX = legendX + 34;

    // Solid = logical
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.moveTo(lineStartX, lineY1);
    ctx.lineTo(lineEndX, lineY1);
    ctx.strokeStyle = legendColor;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText("solid = logical", textX, lineY1);

    // Dashed = statistical
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.moveTo(lineStartX, lineY2);
    ctx.lineTo(lineEndX, lineY2);
    ctx.strokeStyle = legendColor;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillText("dashed = statistical", textX, lineY2);

    // Dotted = semantic
    ctx.beginPath();
    ctx.setLineDash([2, 3]);
    ctx.moveTo(lineStartX, lineY3);
    ctx.lineTo(lineEndX, lineY3);
    ctx.strokeStyle = legendColor;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.fillText("dotted = semantic", textX, lineY3);

    // Note
    ctx.font = "10px var(--font-jetbrains-mono), monospace";
    ctx.globalAlpha = 0.5;
    ctx.fillText("Circle size = log(volume). Click for details.", legendX + 8, legendY + 58);
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [selectedId, selectedEdgeId, platformColors, relationClassColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const nodeMap = new Map<string, SimNode>();
    const nodes: SimNode[] = markets.map((m) => {
      const vol = m.volumeUsd ? parseFloat(m.volumeUsd) : 0;
      const radius = Math.max(3, Math.min(20, 3 + Math.log10(Math.max(1, vol)) * 2));
      const node: SimNode = { ...m, x: 0, y: 0, radius };
      nodeMap.set(m.id, node);
      return node;
    });

    const links: SimLink[] = edges
      .filter((e) => nodeMap.has(e.sourceMarketId) && nodeMap.has(e.targetMarketId))
      .map((e) => ({
        source: nodeMap.get(e.sourceMarketId)!,
        target: nodeMap.get(e.targetMarketId)!,
        relationClass: e.relationClass,
        relationType: e.relationType,
        score: parseFloat(e.score),
        direction: e.direction,
        id: e.id,
        sampleSize: e.sampleSize,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => 80 + (1 - Math.abs(d.score)) * 120)
          .strength((d) => Math.abs(d.score) * 0.5),
      )
      .force("charge", d3.forceManyBody().strength(-200).distanceMax(400))
      .force("center", d3.forceCenter(cx, cy))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => d.radius + 2),
      )
      .alphaDecay(0.02)
      .on("tick", () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      });

    simulationRef.current = simulation;

    const d3CanvasSel = d3.select(canvas);
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      });

    d3CanvasSel.call(zoom);
    zoomRef.current = zoom;
    d3CanvasRef.current = d3CanvasSel;

    if (centerOnNodeRef) {
      centerOnNodeRef.current = (id: string) => {
        const node = nodesRef.current.find((n) => n.id === id);
        if (!node || !canvas) return;
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        const scale = 2;
        const tx = w / 2 - node.x * scale;
        const ty = h / 2 - node.y * scale;
        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3CanvasSel.call(zoom.transform, transform);
      };
    }

    function getNodeAtPoint(px: number, py: number): SimNode | null {
      const t = transformRef.current;
      const mx = (px - t.x) / t.k;
      const my = (py - t.y) / t.k;
      const threshold = 10 / t.k;

      let closest: SimNode | null = null;
      let closestDist = Infinity;

      for (const node of nodesRef.current) {
        const dx = node.x - mx;
        const dy = node.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < node.radius + threshold && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }
      return closest;
    }

    function getEdgeAtPoint(px: number, py: number): SimLink | null {
      const t = transformRef.current;
      const mx = (px - t.x) / t.k;
      const my = (py - t.y) / t.k;
      const threshold = 5 / t.k;

      let closest: SimLink | null = null;
      let closestDist = Infinity;

      for (const link of linksRef.current) {
        const source = link.source as SimNode;
        const target = link.target as SimNode;
        const dist = distToSegment(mx, my, source.x, source.y, target.x, target.y);
        if (dist < threshold && dist < closestDist) {
          closest = link;
          closestDist = dist;
        }
      }
      return closest;
    }

    function handleMouseMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const node = getNodeAtPoint(x, y);

      const prevHovered = hoveredRef.current;
      const prevEdge = hoveredEdgeRef.current;

      if (node) {
        hoveredRef.current = node.id;
        hoveredEdgeRef.current = null;
      } else {
        hoveredRef.current = null;
        const edge = getEdgeAtPoint(x, y);
        hoveredEdgeRef.current = edge?.id ?? null;
      }

      const changed = prevHovered !== hoveredRef.current || prevEdge !== hoveredEdgeRef.current;

      if (changed) {
        onNodeHover(hoveredRef.current);
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      }

      const tooltip = tooltipRef.current;
      if (tooltip) {
        if (node) {
          const prob = node.currentProbability
            ? `${(parseFloat(node.currentProbability) * 100).toFixed(1)}%`
            : "--";
          const vol = node.volumeUsd
            ? `$${parseFloat(node.volumeUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : "--";
          tooltip.innerHTML =
            `<div class="font-mono text-xs" style="max-width:280px">` +
            `<div class="font-semibold" style="word-break:break-word">${node.title}</div>` +
            `<div class="text-text-secondary mt-1">${node.platform} &middot; ${prob} &middot; ${vol}</div>` +
            `</div>`;
          tooltip.style.display = "block";
        } else if (hoveredEdgeRef.current) {
          const link = linksRef.current.find((l) => l.id === hoveredEdgeRef.current);
          if (link) {
            const src = link.source as SimNode;
            const tgt = link.target as SimNode;
            const srcTitle = src.title.length > 36 ? src.title.slice(0, 36) + "..." : src.title;
            const tgtTitle = tgt.title.length > 36 ? tgt.title.slice(0, 36) + "..." : tgt.title;
            tooltip.innerHTML =
              `<div class="font-mono text-xs" style="max-width:300px">` +
              `<div style="word-break:break-word">${srcTitle}</div>` +
              `<div class="text-text-secondary my-0.5" style="font-size:10px">[${classLabel(link.relationClass)}] ${link.relationType}</div>` +
              `<div style="word-break:break-word">${tgtTitle}</div>` +
              `<div class="text-text-secondary mt-1">score: ${link.score.toFixed(3)}</div>` +
              `</div>`;
            tooltip.style.display = "block";
          }
        } else {
          tooltip.style.display = "none";
        }

        if (tooltip.style.display !== "none") {
          const tipRect = tooltip.getBoundingClientRect();
          const containerRect = containerRef.current!.getBoundingClientRect();
          let tipX = event.clientX - containerRect.left + 12;
          let tipY = event.clientY - containerRect.top - 10;
          if (tipX + tipRect.width > containerRect.width) {
            tipX = event.clientX - containerRect.left - tipRect.width - 12;
          }
          if (tipY < 0) tipY = event.clientY - containerRect.top + 20;
          tooltip.style.left = `${tipX}px`;
          tooltip.style.top = `${tipY}px`;
        }
      }

      canvas!.style.cursor = node || hoveredEdgeRef.current ? "pointer" : "grab";
    }

    function handleClick(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const node = getNodeAtPoint(x, y);
      if (node) {
        onNodeClick(node.id);
        return;
      }
      const edge = getEdgeAtPoint(x, y);
      if (edge) {
        onEdgeClick(edge.id);
      }
    }

    function handleMouseLeave() {
      hoveredRef.current = null;
      hoveredEdgeRef.current = null;
      onNodeHover(null);
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    }

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        simulation.force("center", d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.1).restart();
      }
    });
    resizeObserver.observe(container);

    return () => {
      simulation.stop();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      resizeObserver.disconnect();
    };
  }, [markets, edges, draw, onNodeClick, onNodeHover, onEdgeClick, centerOnNodeRef]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [selectedId, selectedEdgeId, draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        role="img"
        aria-label="Prediction market dependency graph. Use mouse to pan, scroll to zoom, click nodes or edges for details."
      />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-surface border border-border px-2 py-1.5"
        style={{ display: "none", borderRadius: "2px", zIndex: 10 }}
      />
    </div>
  );
}
