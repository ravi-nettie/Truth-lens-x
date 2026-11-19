import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { GitBranch, ArrowLeft, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { api, SchemaCaseDetailResponse, SchemaGraphResponse, SchemaObservation } from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
import { GraphView } from "../components/GraphView";

export const Graph: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [graph, setGraph] = useState<SchemaGraphResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, graphRes, obsRes] = await Promise.all([
        api.getCase(caseId),
        api.getGraph(caseId),
        api.getObservations(caseId),
      ]);
      setCaseDetail(caseRes);
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
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title & Controls */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <GitBranch className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Cross-Modal Contradiction Graph (Module 14A)
          </h2>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          {contradictionCount > 0 && (
            <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-red-700 font-bold uppercase tracking-wider">
              {contradictionCount} Contradiction{contradictionCount > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-slate-500 font-medium">
            {graph?.nodes?.length || 0} Nodes · {graph?.edges?.length || 0} Directed Edges
          </span>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-sans px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reload Graph</span>
          </button>
        </div>
      </div>

      {/* Forensic Notice Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-wider text-[11px]">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>USP 1: Multimodal Signal Cross-Examination</span>
        </div>
        <p className="text-blue-800 leading-relaxed">
          The correlation engine constructs deterministic edges between physical signals and textual claims without opening raw media. Red <strong className="text-red-700 font-semibold">CONTRADICTS</strong> edges mandate plain-language alternative explanations and technical limitations.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-20 text-center">
          Computing graph topology and force simulation...
        </div>
      ) : !graph || (graph.edges?.length || 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-xs text-slate-500 space-y-2">
          <GitBranch className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="font-semibold text-slate-700">No Correlation Edges Established Yet</p>
          <p className="max-w-md mx-auto text-xs text-slate-500">
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
