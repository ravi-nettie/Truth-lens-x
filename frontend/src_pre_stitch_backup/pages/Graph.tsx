import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitBranch, ArrowLeft, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { api, SchemaGraphResponse, SchemaObservation } from "../api/client";
import { GraphView } from "../components/GraphView";

export const Graph: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [graph, setGraph] = useState<SchemaGraphResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [graphRes, obsRes] = await Promise.all([
        api.getGraph(caseId),
        api.getObservations(caseId),
      ]);
      setGraph(graphRes);
      setObservations(obsRes || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load cross-modal contradiction graph.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const contradictionCount = (graph?.edges || []).filter(
    (e) => e.relation === "CONTRADICTS"
  ).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          to={`/cases/${caseId}`}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Case Dashboard
        </Link>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-mono transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Reload Graph</span>
        </button>
      </div>

      {/* Screen Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">
            Cross-Modal Contradiction Graph (Module 14A)
          </h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          {contradictionCount > 0 && (
            <span className="rounded-full bg-rose-950/80 border border-rose-700/80 px-2.5 py-0.5 text-rose-300 font-bold uppercase tracking-wider">
              {contradictionCount} Contradiction{contradictionCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-slate-400">
            {graph?.nodes?.length || 0} Nodes · {graph?.edges?.length || 0} Directed Edges
          </span>
        </div>
      </div>

      {/* Forensic Notice Banner */}
      <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[11px]">
          <Info className="h-4 w-4 shrink-0" />
          <span>USP 1: Multimodal Signal Cross-Examination</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          The correlation engine constructs deterministic edges between physical signals and textual claims without opening raw media. Red <strong className="text-rose-400">CONTRADICTS</strong> edges mandate plain-language alternative explanations and technical limitations.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-400 font-mono py-16 text-center">
          Computing graph topology and force simulation...
        </div>
      ) : !graph || (graph.edges?.length || 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center text-xs text-slate-500 space-y-2">
          <GitBranch className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-400">No Correlation Edges Established Yet</p>
          <p className="max-w-md mx-auto text-[11px]">
            Execute the forensic analysis pipeline on this case to correlate observations and claims across modalities.
          </p>
        </div>
      ) : (
        <GraphView
          graph={graph}
          observations={observations}
        />
      )}
    </div>
  );
};

export default Graph;
