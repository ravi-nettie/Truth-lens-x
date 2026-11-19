import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  GitBranch,
  Table as TableIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  AlertTriangle,
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

  // Canvas Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNode = useRef<SimNode | null>(null);

  // Simple physics simulation for layout stabilization
  useEffect(() => {
    let animId: number;
    let iterations = 0;

    const tick = () => {
      if (iterations > 140) return; // Stabilize after warm-up
      iterations++;

      // Repulsion between nodes
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 260) {
            const force = (260 - dist) / dist;
            a.vx -= dx * force * 0.04;
            a.vy -= dy * force * 0.04;
            b.vx += dx * force * 0.04;
            b.vy += dy * force * 0.04;
          }
        }
      }

      // Spring attraction along edges
      const nodeMap = new Map<string, SimNode>();
      simNodes.forEach((n) => nodeMap.set(n.id, n));

      for (const edge of simEdges) {
        const src = nodeMap.get(edge.src_id);
        const dst = nodeMap.get(edge.dst_id);
        if (src && dst) {
          const dx = dst.x - src.x;
          const dy = dst.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 180;
          const force = (dist - targetDist) * 0.03;
          src.vx += (dx / dist) * force;
          src.vy += (dy / dist) * force;
          dst.vx -= (dx / dist) * force;
          dst.vy -= (dy / dist) * force;
        }
      }

      // Center gravity & damping
      for (const node of simNodes) {
        node.vx -= node.x * 0.01;
        node.vy -= node.y * 0.01;
        node.vx *= 0.82;
        node.vy *= 0.82;
        node.x += node.vx;
        node.y += node.vy;
      }

      renderCanvas();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [simNodes, simEdges]);

  // Main Canvas Render
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Light crisp canvas background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center origin
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // Draw Subtle Ambient Dotted Grid (matching Stitch)
    ctx.save();
    const gridSpacing = 32;
    const startX = Math.floor((-canvas.width / 2 - pan.x) / zoom / gridSpacing) * gridSpacing;
    const endX = Math.ceil((canvas.width / 2 - pan.x) / zoom / gridSpacing) * gridSpacing;
    const startY = Math.floor((-canvas.height / 2 - pan.y) / zoom / gridSpacing) * gridSpacing;
    const endY = Math.ceil((canvas.height / 2 - pan.y) / zoom / gridSpacing) * gridSpacing;

    ctx.fillStyle = "#E2E8F0";
    for (let gx = startX; gx <= endX; gx += gridSpacing) {
      for (let gy = startY; gy <= endY; gy += gridSpacing) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.restore();

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    // Draw Edges
    for (const edge of simEdges) {
      const src = nodeMap.get(edge.src_id);
      const dst = nodeMap.get(edge.dst_id);
      if (!src || !dst) continue;

      const isSelected = selectedEdge?.id === edge.id;

      // Color mapping matching Stitch
      let strokeColor = "#64748B";
      let lineWidth = 1.75;
      let isDashed = false;

      if (edge.relation === "CONTRADICTS") {
        strokeColor = "#DC2626"; // Stitch Red
        lineWidth = 2.5;
      } else if (edge.relation === "CO_OCCURS") {
        strokeColor = "#D97706"; // Stitch Amber
        lineWidth = 2.25;
        isDashed = true;
      } else if (edge.relation === "SUPPORTS") {
        strokeColor = "#16A34A"; // Stitch Green
        lineWidth = 2.0;
      } else if (edge.relation === "DERIVED_FROM") {
        strokeColor = "#2563EB"; // Stitch Blue
        lineWidth = 1.75;
      } else if (edge.relation === "NEEDS_REVIEW") {
        strokeColor = "#64748B"; // Stitch Slate
        lineWidth = 1.5;
        isDashed = true;
      }

      ctx.beginPath();
      if (isDashed) {
        ctx.setLineDash([5, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);

      if (isSelected) {
        ctx.strokeStyle = "#2563EB";
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
      ctx.fillStyle = isSelected ? "#2563EB" : "#FFFFFF";
      ctx.fillRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - textWidth / 2 - 4, midY - 7, textWidth + 8, 14);

      ctx.fillStyle = isSelected ? "#FFFFFF" : strokeColor;
      ctx.fillText(text, midX, midY);
      ctx.restore();
    }

    // Draw Nodes
    for (const node of simNodes) {
      const isHovered = hoveredNode?.id === node.id;
      ctx.save();
      ctx.translate(node.x, node.y);

      // Node Shape and Colors (Stitch enterprise theme)
      if (node.kind === "evidence") {
        // Rounded Circle for Evidence
        ctx.fillStyle = "#EFF6FF";
        ctx.strokeStyle = isHovered ? "#2563EB" : "#93C5FD";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (node.kind === "claim") {
        // Diamond for Claim
        ctx.fillStyle = "#F3E8FF";
        ctx.strokeStyle = isHovered ? "#7C3AED" : "#C084FC";
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
        // Circle for Entity
        ctx.fillStyle = "#FDF2F8";
        ctx.strokeStyle = isHovered ? "#DB2777" : "#F472B6";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (node.kind === "time_anchor") {
        // Square for Time Anchor
        ctx.fillStyle = "#FFFBEB";
        ctx.strokeStyle = isHovered ? "#D97706" : "#FBBF24";
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.fillRect(-node.radius, -node.radius, node.radius * 2, node.radius * 2);
        ctx.strokeRect(-node.radius, -node.radius, node.radius * 2, node.radius * 2);
      } else {
        // Observation: circle colored by strength
        let bg = "#F8FAFC";
        let border = "#CBD5E1";
        if (node.strength === "strong") {
          bg = "#FDEBEC";
          border = "#DC2626";
        } else if (node.strength === "moderate") {
          bg = "#FFF5E6";
          border = "#D97706";
        } else if (node.strength === "weak") {
          bg = "#EFF6FF";
          border = "#2563EB";
        }

        ctx.fillStyle = bg;
        ctx.strokeStyle = isHovered ? "#2563EB" : border;
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
      ctx.fillStyle = "#111827"; // Dark text for high contrast on light canvas
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
    renderCanvas();
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
    draggedNode.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.4, Math.min(2.8, z * zoomFactor)));
  };

  // Filtered edges for table view
  const filteredEdges = useMemo(() => {
    return simEdges.filter((e) => {
      if (relationFilter !== "all" && e.relation !== relationFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.rule.toLowerCase().includes(q) ||
          e.explanation.toLowerCase().includes(q) ||
          e.src_id.toLowerCase().includes(q) ||
          e.dst_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [simEdges, relationFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* View Switcher & Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded border border-outline-variant shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              viewMode === "graph"
                ? "bg-primary-container text-white shadow-sm"
                : "bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container"
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" /> Interactive Graph
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
              viewMode === "table"
                ? "bg-primary-container text-white shadow-sm"
                : "bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table View (Accessible)
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> CONTRADICTS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> CO_OCCURS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> SUPPORTS
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> DERIVED_FROM
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" /> NEEDS_REVIEW
          </span>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div
          ref={containerRef}
          className="relative rounded border border-outline-variant bg-white overflow-hidden shadow-sm h-[620px] select-none"
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
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 bg-white border border-outline-variant rounded p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.8, z * 1.2))}
              className="p-1.5 hover:bg-surface-container-low text-on-surface rounded"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
              className="p-1.5 hover:bg-surface-container-low text-on-surface rounded"
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
              className="p-1.5 hover:bg-surface-container-low text-on-surface rounded"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-3 left-4 text-[11px] font-mono text-on-surface-variant bg-white/90 px-2.5 py-1 rounded border border-outline-variant shadow-sm">
            Click edge to inspect · Drag nodes to reposition · Scroll to zoom
          </div>

          {/* Edge Evidence Drawer */}
          {selectedEdge && (
            <div className="absolute top-0 right-0 h-full w-full sm:w-[440px] bg-white border-l border-outline-variant p-6 shadow-2xl overflow-y-auto space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedEdge.relation === "CONTRADICTS"
                        ? "bg-[#FDEBEC] text-[#DC2626] border border-rose-200"
                        : selectedEdge.relation === "CO_OCCURS"
                        ? "bg-[#FFF5E6] text-[#D97706] border border-amber-200"
                        : selectedEdge.relation === "SUPPORTS"
                        ? "bg-[#EFF6FF] text-[#2563EB] border border-blue-200"
                        : "bg-surface-container text-on-surface-variant border border-outline-variant"
                    }`}
                  >
                    {selectedEdge.relation}
                  </span>
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {selectedEdge.rule}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEdge(null)}
                  className="p-1 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container-low"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-mono">Edge Strength:</span>
                <StrengthBadge strength={selectedEdge.strength as any} />
              </div>

              {/* Edge Connection Endpoints */}
              <div className="rounded border border-outline-variant bg-surface-container-low p-3 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Source:</span>
                  <span className="text-primary font-semibold">{selectedEdge.src_id}</span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span>Target:</span>
                  <span className="text-primary font-semibold">{selectedEdge.dst_id}</span>
                </div>
              </div>

              {/* Templated Explanation */}
              <div>
                <h5 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                  Correlation Explanation
                </h5>
                <p className="text-xs text-on-surface leading-relaxed bg-surface-container-low p-3 rounded border border-outline-variant">
                  {selectedEdge.explanation}
                </p>
              </div>

              {/* Benign Alternative Explanation */}
              {selectedEdge.alternative_explanation && (
                <div className="rounded border border-[rgba(217,119,6,0.3)] bg-[#FFF5E6] p-3.5 space-y-1">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                    <AlertTriangle className="h-3.5 w-3.5" /> Benign Alternative Explanation
                  </span>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {selectedEdge.alternative_explanation}
                  </p>
                </div>
              )}

              {/* Cited Observation IDs */}
              {selectedEdge.evidence_observation_ids.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Cited Evidence & Observation Links ({selectedEdge.evidence_observation_ids.length})
                  </h5>
                  <div className="space-y-1.5">
                    {selectedEdge.evidence_observation_ids.map((id) => {
                      const matchedObs = observations.find((o) => o.id === id);
                      return (
                        <div
                          key={id}
                          onClick={() => {
                            if (matchedObs) setSelectedObsDetail(matchedObs);
                            if (onSelectObservation) onSelectObservation(id);
                          }}
                          className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant hover:border-primary cursor-pointer transition-colors text-xs font-mono"
                        >
                          <span className="text-primary font-semibold">{id}</span>
                          {matchedObs && (
                            <span className="text-[10px] text-on-surface-variant truncate max-w-[180px]">
                              {matchedObs.indicator}
                            </span>
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
        /* Table View Fallback */
        <div className="rounded border border-outline-variant bg-white p-5 shadow-sm space-y-4">
          {/* Table Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search rule, explanation, or node IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded pl-9 pr-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-on-surface-variant" />
              <select
                aria-label="Filter by Relationship Type"
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
                className="bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="all">All Relations</option>
                <option value="CONTRADICTS">CONTRADICTS</option>
                <option value="CO_OCCURS">CO_OCCURS</option>
                <option value="SUPPORTS">SUPPORTS</option>
                <option value="DERIVED_FROM">DERIVED_FROM</option>
                <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded border border-outline-variant">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-2.5 px-3 font-semibold">Relation</th>
                  <th className="py-2.5 px-3 font-semibold">Rule</th>
                  <th className="py-2.5 px-3 font-semibold">Strength</th>
                  <th className="py-2.5 px-3 font-semibold">Source &rarr; Target</th>
                  <th className="py-2.5 px-3 font-semibold">Forensic Explanation</th>
                  <th className="py-2.5 px-3 font-semibold">Alternative Explanation</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60 font-sans">
                {filteredEdges.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          e.relation === "CONTRADICTS"
                            ? "bg-[#FDEBEC] text-[#DC2626]"
                            : e.relation === "CO_OCCURS"
                            ? "bg-[#FFF5E6] text-[#D97706]"
                            : e.relation === "SUPPORTS"
                            ? "bg-[#EFF6FF] text-[#2563EB]"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {e.relation}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-primary">
                      {e.rule}
                    </td>
                    <td className="py-2.5 px-3">
                      <StrengthBadge strength={e.strength as any} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                      <span className="text-on-surface">{e.src_id}</span>
                      <span className="mx-1 text-slate-400">→</span>
                      <span className="text-on-surface">{e.dst_id}</span>
                    </td>
                    <td className="py-2.5 px-3 max-w-xs text-on-surface text-xs leading-relaxed">
                      {e.explanation}
                    </td>
                    <td className="py-2.5 px-3 max-w-xs text-on-surface-variant text-[11px] leading-relaxed">
                      {e.alternative_explanation || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEdge(e);
                          setViewMode("graph");
                        }}
                        className="text-primary hover:text-blue-800 font-semibold text-xs"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphView;
