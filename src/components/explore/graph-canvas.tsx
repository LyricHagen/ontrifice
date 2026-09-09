"use client";

import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { MarketNode, GraphEdge, PLATFORM_COLORS, EDGE_TYPE_COLORS } from "./types";

interface SimNode extends MarketNode {
  x: number;
  y: number;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edgeType: string;
  weight: number;
  direction: string;
  id: string;
}

interface GraphCanvasProps {
  markets: MarketNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null) => void;
  platformColors: typeof PLATFORM_COLORS;
  edgeTypeColors: typeof EDGE_TYPE_COLORS;
}

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
}

export function GraphCanvas({
  markets,
  edges,
  selectedId,
  onNodeClick,
  onNodeHover,
  platformColors,
  edgeTypeColors,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const transform = transformRef.current;
    const theme = getTheme();
    const isDark = theme === "dark";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hoveredId = hoveredRef.current;
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
      const colors = edgeTypeColors[link.edgeType] ?? edgeTypeColors.semantic;
      const baseColor = isDark ? colors.dark : colors.light;
      let opacity = colors.opacity * link.weight;

      if (hoveredId) {
        opacity = hoveredEdges.has(link.id) ? Math.max(opacity, 0.6) : opacity * 0.15;
      }
      if (selectedId) {
        const src = source.id;
        const tgt = target.id;
        if (src === selectedId || tgt === selectedId) {
          opacity = Math.max(opacity, 0.6);
        } else if (!hoveredId) {
          opacity *= 0.3;
        }
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = 1 / transform.k;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const zoomLevel = transform.k;
    const showLabels = zoomLevel > 1.5;

    for (const node of nodesRef.current) {
      const color = platformColors[node.platform] ?? "#7c7c7c";
      let alpha = 1;

      if (hoveredId && hoveredId !== node.id && !connectedToHovered.has(node.id)) {
        alpha = 0.15;
      }
      if (selectedId && selectedId !== node.id && !hoveredId) {
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
  }, [selectedId, platformColors, edgeTypeColors]);

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
        edgeType: e.edgeType,
        weight: parseFloat(e.weight),
        direction: e.direction,
        id: e.id,
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
          .distance((d) => 80 + (1 - d.weight) * 120)
          .strength((d) => d.weight * 0.5),
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

    const d3Canvas = d3.select(canvas);
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
      });

    d3Canvas.call(zoom);

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

    function handleMouseMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const node = getNodeAtPoint(x, y);

      const prevHovered = hoveredRef.current;
      hoveredRef.current = node?.id ?? null;

      if (prevHovered !== hoveredRef.current) {
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
        } else {
          tooltip.style.display = "none";
        }
      }

      canvas!.style.cursor = node ? "pointer" : "grab";
    }

    function handleClick(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const node = getNodeAtPoint(x, y);
      if (node) {
        onNodeClick(node.id);
      }
    }

    function handleMouseLeave() {
      hoveredRef.current = null;
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
  }, [markets, edges, draw, onNodeClick, onNodeHover]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [selectedId, draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none bg-surface border border-border px-2 py-1.5"
        style={{ display: "none", borderRadius: "2px", zIndex: 10 }}
      />
    </div>
  );
}
