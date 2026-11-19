import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  GitBranch,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ExternalLink,
  AlertTriangle,
  Info,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";
import { SchemaGraphResponse, SchemaObservation } from "../api/client";
import { StrengthBadge } from "./StrengthBadge";

interface GraphViewProps {
  graph: SchemaGraphResponse;
  observations?: SchemaObservation[];
  onSelectObservation?: (obsId: string) => void;
}

interface SimNode {
  id: string;
  label: string;
  kind: "evidence" | "observation" | "claim" | "entity" | "time_anchor" | string;
  modality?: string | null;
  strength?: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimEdge {
  id: string;
  src_id: string;
  dst_id: string;
  relation: "CONTRADICTS" | "CO_OCCURS" | "SUPPORTS" | "DERIVED_FROM" | "NEEDS_REVIEW";
  rule: string;
  strength: string;
  explanation: string;
  alternative_explanation?: string;
  evidence_observation_ids: string[];
}

export const GraphView: React.FC<GraphViewProps> = ({
  graph,
  observations = [],
  onSelectObservation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [selectedEdge, setSelectedEdge] = useState<SimEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedObsDetail, setSelectedObsDetail] = useState<SchemaObservation | null>(null);

  // Table filtering state
  const [relationFilter, setRelationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Transform graph into simulation elements
  const simNodes = useMemo<SimNode[]>(() => {
    const nodes = (graph.nodes || []).map((n, idx) => {
      const angle = (idx / Math.max(1, (graph.nodes || []).length)) * 2 * Math.PI;
      const dist = 160 + (idx % 3) * 60;
      return {
        id: n.id,
        label: n.label,
        kind: n.kind as any,
        modality: n.modality,
        strength: n.strength,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: (n.kind as string) === "evidence" ? 22 : (n.kind as string) === "claim" ? 18 : 15,
      };
    });
    return nodes;
  }, [graph.nodes]);

  const simEdges = useMemo<SimEdge[]>(() => {
    return (graph.edges || []).map((e) => ({
      id: e.id,
      src_id: e.src_id,
      dst_id: e.dst_id,
      relation: e.relation as any,
      rule: e.rule,
      strength: e.strength,
      explanation: e.explanation,
      alternative_explanation: e.alternative_explanation,
      evidence_observation_ids: e.evidence_observation_ids || [],
    }));
  }, [graph.edges]);

  // Viewport pan & zoom
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingCanvas = useRef(false);
  const draggedNode = useRef<SimNode | null>(null);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Simulation physics loop
  useEffect(() => {
    if (viewMode !== "graph") return;

    let animFrame: number;
    let iteration = 0;

    const tick = () => {
      // Repulsion between all nodes
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 10;
          const dist = Math.sqrt(distSq);
          if (dist < 320) {
            const force = 1200 / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // Spring attraction along edges
      const nodeMap = new Map<string, SimNode>();
      simNodes.forEach((n) => nodeMap.set(n.id, n));

      for (const e of simEdges) {
        const a = nodeMap.get(e.src_id);
        const b = nodeMap.get(e.dst_id);
        if (a && b) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;
          const desired = e.relation === "CONTRADICTS" ? 170 : 120;
          const force = (dist - desired) * 0.04;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Center gravity & damping
      for (const n of simNodes) {
        n.vx -= n.x * 0.005;
        n.vy -= n.y * 0.005;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }

      renderCanvas();
      iteration++;
      if (iteration < 240 || draggedNode.current) {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [simNodes, simEdges, zoom, pan, viewMode, selectedEdge, hoveredNode]);

  // Canvas drawing routine
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Grid pattern
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);

    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    // Draw Edges
    for (const edge of simEdges) {
      const src = nodeMap.get(edge.src_id);
      const dst = nodeMap.get(edge.dst_id);
      if (!src || !dst) continue;

      const isSelected = selectedEdge?.id === edge.id;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);

      let strokeColor = "#64748b";
      let lineWidth = 2;
      ctx.setLineDash([]);

      if (edge.relation === "CONTRADICTS") {
        strokeColor = "#f43f5e";
        lineWidth = 3;
      } else if (edge.relation === "CO_OCCURS") {
        strokeColor = "#f59e0b";
        lineWidth = 2.5;
      } else if (edge.relation === "SUPPORTS") {
        strokeColor = "#10b981";
        lineWidth = 2;
      } else if (edge.relation === "DERIVED_FROM") {
        strokeColor = "#3b82f6";
        lineWidth = 2;
      } else if (edge.relation === "NEEDS_REVIEW") {
        strokeColor = "#94a3b8";
        lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
      }

      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lineWidth + 3;
        ctx.stroke();
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? lineWidth + 1 : lineWidth;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw relation label pill at midpoint
      const midX = (src.x + dst.x) / 2;
      const midY = (src.y + dst.y) / 2;

      ctx.save();
      ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const text = edge.relation;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = isSelected ? "#ffffff" : "#0f172a";
      ctx.fillRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);

      ctx.fillStyle = isSelected ? "#0f172a" : strokeColor;
      ctx.fillText(text, midX, midY);
      ctx.restore();
    }

    // Draw Nodes
    for (const node of simNodes) {
      const isHovered = hoveredNode?.id === node.id;
      ctx.save();
      ctx.translate(node.x, node.y);

      // Node Shape and Colors
      if (node.kind === "evidence") {
        // Hexagon / Rounded Rect for Evidence
        ctx.fillStyle = "#0369a1";
        ctx.strokeStyle = isHovered ? "#38bdf8" : "#0284c7";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (node.kind === "claim") {
        // Diamond for Claim
        ctx.fillStyle = "#6d28d9";
        ctx.strokeStyle = isHovered ? "#c084fc" : "#7c3aed";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(0, -node.radius - 2);
        ctx.lineTo(node.radius + 2, 0);
        ctx.lineTo(0, node.radius + 2);
        ctx.lineTo(-node.radius - 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (node.kind === "entity") {
        // Pill / Rounded Rect for Entity
        ctx.fillStyle = "#701a75";
        ctx.strokeStyle = isHovered ? "#e879f9" : "#a21caf";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (node.kind === "time_anchor") {
        // Square for Time Anchor
        ctx.fillStyle = "#78350f";
        ctx.strokeStyle = isHovered ? "#fbbf24" : "#d97706";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.fillRect(-node.radius, -node.radius, node.radius * 2, node.radius * 2);
        ctx.strokeRect(-node.radius, -node.radius, node.radius * 2, node.radius * 2);
      } else {
        // Observation: circle colored by strength
        let bg = "#1e293b";
        let border = "#475569";
        if (node.strength === "strong") {
          bg = "#991b1b";
          border = "#f87171";
        } else if (node.strength === "moderate") {
          bg = "#9a3412";
          border = "#fb923c";
        } else if (node.strength === "weak") {
          bg = "#854d0e";
          border = "#facc15";
        } else {
          bg = "#1e3a5f";
          border = "#60a5fa";
        }

        ctx.fillStyle = bg;
        ctx.strokeStyle = isHovered ? "#ffffff" : border;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // Node Label
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e2e8f0";
      const truncated = node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label;
      ctx.fillText(truncated, 0, node.radius + 4);

      ctx.restore();
    }

    ctx.restore();
  };

  // Resize canvas to container
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = Math.max(540, containerRef.current.clientHeight);
        renderCanvas();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse interaction handlers (Pan, Drag, Click edge/node)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2 - pan.x;
    const mouseY = e.clientY - rect.top - canvas.height / 2 - pan.y;

    const simX = mouseX / zoom;
    const simY = mouseY / zoom;

    // Check if clicked a node
    for (const node of simNodes) {
      const dx = simX - node.x;
      const dy = simY - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 6) {
        draggedNode.current = node;
        return;
      }
    }

    // Check if clicked an edge (distance to line segment)
    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    for (const edge of simEdges) {
      const src = nodeMap.get(edge.src_id);
      const dst = nodeMap.get(edge.dst_id);
      if (src && dst) {
        const midX = (src.x + dst.x) / 2;
        const midY = (src.y + dst.y) / 2;
        const dMid = Math.sqrt((simX - midX) ** 2 + (simY - midY) ** 2);
        if (dMid < 30) {
          setSelectedEdge(edge);
          return;
        }
      }
    }

    // Otherwise pan canvas
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNode.current) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - canvas.width / 2 - pan.x;
      const mouseY = e.clientY - rect.top - canvas.height / 2 - pan.y;
      draggedNode.current.x = mouseX / zoom;
      draggedNode.current.y = mouseY / zoom;
      draggedNode.current.vx = 0;
      draggedNode.current.vy = 0;
      renderCanvas();
      return;
    }

    if (isDraggingCanvas.current) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
      return;
    }

    // Hover detection
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - canvas.width / 2 - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - canvas.height / 2 - pan.y) / zoom;

    let found: SimNode | null = null;
    for (const node of simNodes) {
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
    draggedNode.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.min(2.8, Math.max(0.4, z * delta)));
  };

  // Filtered edges for table view
  const filteredEdges = useMemo(() => {
    return simEdges.filter((edge) => {
      const matchesRelation = relationFilter === "all" || edge.relation === relationFilter;
      const matchesSearch =
        searchQuery === "" ||
        edge.rule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edge.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edge.src_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        edge.dst_id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRelation && matchesSearch;
    });
  }, [simEdges, relationFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* View Mode Controls & Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "graph"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" /> Interactive Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "table"
                ? "bg-indigo-600 text-white shadow"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table View (Accessible)
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> CONTRADICTS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> CO_OCCURS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> SUPPORTS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> DERIVED_FROM
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" /> NEEDS_REVIEW
          </span>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div
          ref={containerRef}
          className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner h-[620px] select-none"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />

          {/* Canvas Floating Controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 shadow-lg backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.8, z * 1.2))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1.0);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-3 left-4 text-[11px] font-mono text-slate-500 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
            Click edge to inspect · Drag nodes to reposition · Scroll to zoom
          </div>

          {/* Edge Evidence Drawer */}
          {selectedEdge && (
            <div className="absolute top-0 right-0 h-full w-full sm:w-[420px] bg-slate-900/95 border-l border-slate-800 p-5 shadow-2xl backdrop-blur-md overflow-y-auto space-y-4 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedEdge.relation === "CONTRADICTS"
                        ? "bg-rose-950 text-rose-300 border border-rose-700"
                        : selectedEdge.relation === "CO_OCCURS"
                        ? "bg-amber-950 text-amber-300 border border-amber-700"
                        : selectedEdge.relation === "SUPPORTS"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {selectedEdge.relation}
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    {selectedEdge.rule}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEdge(null)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">Edge Strength:</span>
                <StrengthBadge strength={selectedEdge.strength as any} />
              </div>

              {/* Edge Connection Endpoints */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-slate-500">Source:</span>
                  <span className="text-indigo-400">{selectedEdge.src_id}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-slate-500">Target:</span>
                  <span className="text-indigo-400">{selectedEdge.dst_id}</span>
                </div>
              </div>

              {/* Templated Explanation */}
              <div>
                <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Correlation Explanation
                </h5>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  {selectedEdge.explanation}
                </p>
              </div>

              {/* Benign Alternative Explanation */}
              {selectedEdge.alternative_explanation && (
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3.5 space-y-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Benign Alternative Explanation
                  </span>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {selectedEdge.alternative_explanation}
                  </p>
                </div>
              )}

              {/* Cited Observations */}
              {selectedEdge.evidence_observation_ids.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Cited Evidence Observations ({selectedEdge.evidence_observation_ids.length})
                  </h5>
                  <div className="space-y-1.5">
                    {selectedEdge.evidence_observation_ids.map((obsId) => {
                      const obs = observations.find((o) => o.id === obsId);
                      return (
                        <div
                          key={obsId}
                          onClick={() => {
                            if (obs) setSelectedObsDetail(obs);
                            if (onSelectObservation) onSelectObservation(obsId);
                          }}
                          className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs space-y-1 hover:border-indigo-500 hover:bg-slate-900 cursor-pointer transition-all shadow-sm group/obs"
                          title="Click to view full observation finding"
                        >
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-indigo-400 group-hover/obs:text-indigo-300 font-bold underline flex items-center gap-1">
                              {obsId}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                            {obs && <StrengthBadge strength={obs.evidence_strength} />}
                          </div>
                          {obs && (
                            <p className="text-[11px] text-slate-300 font-sans line-clamp-2">
                              {obs.summary}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Accessible Filterable Table View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {["all", "CONTRADICTS", "CO_OCCURS", "SUPPORTS", "DERIVED_FROM", "NEEDS_REVIEW"].map(
                (rel) => (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => setRelationFilter(rel)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      relationFilter === rel
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {rel === "all" ? "All Relations" : rel}
                  </button>
                )
              )}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search rule or explanation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4">Relation</th>
                  <th className="py-3 px-4">Rule Name</th>
                  <th className="py-3 px-4">Source / Target</th>
                  <th className="py-3 px-4">Strength</th>
                  <th className="py-3 px-4">Explanation & Alternative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-sans">
                {filteredEdges.map((edge) => (
                  <tr
                    key={edge.id}
                    onClick={() => {
                      setSelectedEdge(edge);
                      setViewMode("graph");
                    }}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          edge.relation === "CONTRADICTS"
                            ? "bg-rose-950 text-rose-300 border border-rose-700"
                            : edge.relation === "CO_OCCURS"
                            ? "bg-amber-950 text-amber-300 border border-amber-700"
                            : edge.relation === "SUPPORTS"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                            : "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {edge.relation}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {edge.rule}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      <div>Src: {edge.src_id}</div>
                      <div>Dst: {edge.dst_id}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StrengthBadge strength={edge.strength as any} />
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      <p className="text-slate-200">{edge.explanation}</p>
                      {edge.alternative_explanation && (
                        <p className="text-[11px] text-amber-300/90 bg-amber-950/20 p-1.5 rounded border border-amber-900/40">
                          <span className="font-semibold text-amber-400">Alternative: </span>
                          {edge.alternative_explanation}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clickable Cited Observation Modal */}
      {selectedObsDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded">
                  {selectedObsDetail.indicator}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  via {selectedObsDetail.method}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObsDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">
                {selectedObsDetail.summary}
              </h4>
              <StrengthBadge strength={selectedObsDetail.evidence_strength} />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              {selectedObsDetail.explanation}
            </p>

            {selectedObsDetail.alternative_explanation && (
              <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 space-y-1 text-xs">
                <span className="block font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                  Alternative Explanation (Benign Potential)
                </span>
                <p className="text-amber-200/90 leading-relaxed">
                  {selectedObsDetail.alternative_explanation}
                </p>
              </div>
            )}

            {selectedObsDetail.limitations && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-1 text-xs">
                <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Forensic Limitations
                </span>
                <p className="text-slate-400 leading-relaxed">
                  {selectedObsDetail.limitations}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedObsDetail(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Close Finding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
