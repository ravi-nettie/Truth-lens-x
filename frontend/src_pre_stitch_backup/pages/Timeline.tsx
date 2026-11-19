import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Clock, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  api,
  SchemaTimelineResponse,
  SchemaCaseDetailResponse,
} from "../api/client";
import { TimelineView } from "../components/TimelineView";

export const Timeline: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [timelineData, setTimelineData] = useState<SchemaTimelineResponse | null>(null);
  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [tlRes, caseRes] = await Promise.all([
        api.getTimeline(caseId),
        api.getCase(caseId),
      ]);
      setTimelineData(tlRes);
      setCaseDetail(caseRes);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load provenance timeline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const events = timelineData?.events || [];
  const evidenceItems = caseDetail?.evidence_items || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb */}
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
          <span>Reload Timeline</span>
        </button>
      </div>

      {/* Screen Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">
            Evidence Provenance & Tamper Timeline (Module 14B)
          </h1>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {events.length} Recorded Provenance Events · {evidenceItems.length} Evidence Items
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-400 font-mono py-16 text-center">
          Loading chronological provenance events...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center text-xs text-slate-500 space-y-2">
          <Clock className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-400">No Timeline Events Recorded Yet</p>
          <p className="max-w-md mx-auto text-[11px]">
            Ingest evidence media or execute the analysis pipeline to generate provenance trail entries.
          </p>
        </div>
      ) : (
        <TimelineView
          caseId={caseId!}
          events={events}
          evidenceItems={evidenceItems}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};

export default Timeline;
