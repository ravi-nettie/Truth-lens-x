import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Clock, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import {
  api,
  SchemaTimelineResponse,
  SchemaCaseDetailResponse,
} from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
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
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title & Controls */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="h-5 w-5 text-purple-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Evidence Provenance & Tamper Timeline (Module 14B)
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono font-medium">
            {events.length} Recorded Provenance Events · {evidenceItems.length} Evidence Items
          </span>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-sans px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reload Timeline</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-20 text-center">
          Loading chronological provenance events...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-xs text-slate-500 space-y-2">
          <Clock className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="font-semibold text-slate-700">No Timeline Events Recorded Yet</p>
          <p className="max-w-md mx-auto text-xs text-slate-500">
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
