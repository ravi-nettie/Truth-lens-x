import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileCheck2,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCw,
  ExternalLink,
  Loader2,
  FileText,
  Clock,
  GitBranch,
  Video,
  Image as ImageIcon,
  Music,
  CheckCircle2,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  CheckSquare,
  AlertCircle,
  TrendingUp,
  Cpu,
  Download,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaObservation,
  SchemaEvidenceResponse,
  SchemaAnalysisStatusResponse,
} from "../api/client";
import { StatusBar } from "../components/StatusBar";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
import { ObservationCard } from "../components/ObservationCard";
import { EvidenceStrengthLegend } from "../components/EvidenceStrengthLegend";
import { EvidenceViewer } from "../components/EvidenceViewer";

const ANALYZER_CATALOG = [
  { key: "exif", name: "EXIF Metadata", modality: "image" },
  { key: "ela", name: "ELA Heatmap", modality: "image" },
  { key: "copymove", name: "SIFT Copy-Move", modality: "image" },
  { key: "ffprobe", name: "ffprobe Stream", modality: "video" },
  { key: "scenecut", name: "Scene Cut HSV", modality: "video" },
  { key: "pts", name: "PTS Continuity", modality: "video" },
  { key: "flux", name: "Spectral Flux", modality: "audio" },
  { key: "whisper", name: "Whisper ASR (int8)", modality: "audio" },
  { key: "claim", name: "Claim Extraction", modality: "text" },
  { key: "correlation", name: "Correlation Engine", modality: "graph" },
];

export const Dashboard: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();

  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [statusInfo, setStatusInfo] = useState<SchemaAnalysisStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status polling
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Case reviews summary
  const [caseReviews, setCaseReviews] = useState<any[]>([]);

  const loadCaseData = async () => {
    if (!caseId) return;
    try {
      const [cRes, obsRes, revRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId).catch(() => []),
        api.getCaseReviews(caseId).catch(() => ({ reviews: [] })),
      ]);
      setCaseDetail(cRes);
      setObservations(obsRes || []);
      setCaseReviews(revRes.reviews || []);

      if (cRes.case.status === "analyzing" || cRes.case.status === "running") {
        setIsAnalyzing(true);
      } else {
        setIsAnalyzing(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load case details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  // Polling effect every 1.5s while analyzing (stops once correlated, in_review, reported, completed)
  useEffect(() => {
    if (!caseId || !isAnalyzing) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const st = await api.getCaseStatus(caseId);
        setStatusInfo(st);
        if (
          st.status === "completed" ||
          st.status === "failed" ||
          st.status === "idle" ||
          st.current_step?.includes("correlated") ||
          st.current_step?.includes("in_review") ||
          st.current_step?.includes("reported") ||
          (st.progress_percent ?? 0) >= 100
        ) {
          setIsAnalyzing(false);
          loadCaseData();
        }
      } catch {
        // silent retry
      }
    }, 1500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [caseId, isAnalyzing]);

  // Trigger manual re-analysis
  const handleTriggerAnalysis = async () => {
    if (!caseId) return;
    setIsAnalyzing(true);
    try {
      await api.triggerAnalysis(caseId, false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start analysis.");
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-xs text-slate-500 font-mono">
        <Loader2 className="h-5 w-5 animate-spin mr-2.5 text-blue-600" />
        Loading case dashboard...
      </div>
    );
  }

  if (!caseDetail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Case Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">{errorMsg || `Case ID "${caseId}" does not exist.`}</p>
        <Link to="/history" className="inline-block mt-4 text-xs font-semibold text-blue-600 hover:underline">
          Return to Investigations Archive
        </Link>
      </div>
    );
  }

  const c = caseDetail.case;
  const evidenceItems = caseDetail.evidence_items || [];

  // Determine Review Priority and Formula
  const strongCount = observations.filter((o) => o.evidence_strength === "strong").length;
  const moderateCount = observations.filter((o) => o.evidence_strength === "moderate").length;
  const weakCount = observations.filter((o) => o.evidence_strength === "weak").length;
  const infoCount = observations.filter((o) => o.evidence_strength === "informational").length;
  const contradictionCount = caseDetail.contradiction_count || 0;

  let priorityLabel = "LOW REVIEW PRIORITY";
  let priorityStyle = "bg-emerald-50 text-emerald-800 border-emerald-200";
  let priorityReason = "No strong evidence anomalies or cross-modal contradictions detected.";

  if (strongCount >= 1 || contradictionCount >= 1) {
    priorityLabel = "HIGH REVIEW PRIORITY";
    priorityStyle = "bg-red-50 text-red-800 border-red-200";
    priorityReason = `${strongCount} strong anomaly finding(s) and ${contradictionCount} cross-modal contradiction(s) require human review.`;
  } else if (moderateCount >= 1) {
    priorityLabel = "MEDIUM REVIEW PRIORITY";
    priorityStyle = "bg-amber-50 text-amber-800 border-amber-200";
    priorityReason = `${moderateCount} moderate finding(s) warranting human scrutiny.`;
  }

  // Modality-specific observation counts
  const imageObsCount = observations.filter((o) => o.modality === "image").length;
  const videoObsCount = observations.filter((o) => o.modality === "video").length;
  const audioObsCount = observations.filter((o) => o.modality === "audio").length;
  const textObsCount = observations.filter((o) => o.modality === "text").length;

  // Review Progress Calculation
  const reviewedTargetIds = new Set(caseReviews.map((r) => r.target_id));
  const reviewedObsCount = observations.filter((o) => reviewedTargetIds.has(o.id)).length;
  const reviewProgressPct =
    observations.length > 0 ? Math.round((reviewedObsCount / observations.length) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* 1. Stitch Case Header & Tabs */}
      <CaseHeaderTabs caseData={c} caseId={c.id} />

      {/* 2. Pipeline Controls & Priority Callout */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${priorityStyle}`}>
              {priorityLabel}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Registered: {new Date(c.created_at).toLocaleDateString()}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            <span>{isAnalyzing ? "Executing Pipeline..." : "Re-Run Analysis"}</span>
          </button>
        </div>

        {/* Priority Formula Explainer */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              <strong className="text-slate-900">Review Priority Rule:</strong> HIGH if (strong ≥ 1 OR contradictions ≥ 1) · MEDIUM if (moderate ≥ 1) · LOW otherwise.
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[11px] italic">
            {priorityReason}
          </span>
        </div>

        {/* 5-Stage Status Bar */}
        <StatusBar
          status={c.status || "created"}
          hasReport={c.status === "correlated" || c.status === "in_review" || c.status === "reported"}
        />

        {isAnalyzing && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 flex items-center justify-between animate-pulse">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Analyzing multimodal media on local CPU (polling every 1.5 s)...</span>
            </span>
            <span className="font-mono text-[11px] text-blue-700">
              {statusInfo?.current_step || "Running pipeline analyzers..."}
            </span>
          </div>
        )}
      </div>

      {/* 3. Per-Analyzer Run Status */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Per-Analyzer Execution Status
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Pure Rule-Based Forensic Pipeline
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {ANALYZER_CATALOG.map((analyzer) => {
            const matchingObs = observations.filter(
              (o) =>
                o.method.toLowerCase().includes(analyzer.key) ||
                o.indicator.toLowerCase().includes(analyzer.key)
            );
            const isCompleted = matchingObs.length > 0 || c.status === "correlated" || c.status === "reported" || c.status === "completed";
            const isFailed = statusInfo?.errors?.some((e) => e.toLowerCase().includes(analyzer.key));

            return (
              <div
                key={analyzer.key}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 flex items-center justify-between"
              >
                <div className="min-w-0 pr-1">
                  <span className="font-mono text-xs font-semibold text-slate-800 block truncate">
                    {analyzer.name}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">
                    {analyzer.modality}
                  </span>
                </div>
                <span
                  className={`flex h-2.5 w-2.5 rounded-full shrink-0 ${
                    isFailed
                      ? "bg-red-500 ring-2 ring-red-200"
                      : isCompleted
                      ? "bg-emerald-500 ring-2 ring-emerald-200"
                      : isAnalyzing
                      ? "bg-blue-500 animate-ping"
                      : "bg-slate-300"
                  }`}
                  title={isFailed ? "Failed" : isCompleted ? "Completed" : "Pending"}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Telemetry Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Findings Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1.5">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
            Total Indicators
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{observations.length}</span>
            <span className="text-xs text-slate-500">observations</span>
          </div>
          <div className="flex gap-2 text-xs font-mono pt-1 text-slate-600">
            <span className="text-red-600 font-semibold">{strongCount} strong</span>
            <span>·</span>
            <span className="text-amber-600 font-semibold">{moderateCount} mod</span>
            <span>·</span>
            <span className="text-blue-600 font-semibold">{weakCount} weak</span>
          </div>
        </div>

        {/* Contradictions Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1.5">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
            Cross-Modal Contradictions
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${contradictionCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
              {contradictionCount}
            </span>
            <span className="text-xs text-slate-500">conflict edges</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1 leading-snug">
            {contradictionCount > 0
              ? "Signals conflict across independent modalities."
              : "No conflicting cross-modal signals."}
          </p>
        </div>

        {/* Evidence Ingested Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1.5">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
            Ingested Evidence Items
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{evidenceItems.length}</span>
            <span className="text-xs text-slate-500">sealed files</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 font-semibold block pt-1">
            Mode 0444 · Read-Only Store
          </span>
        </div>

        {/* Human Review Progress Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
            <span>Human Review Progress</span>
            <span className="text-blue-600 font-bold">{reviewProgressPct}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              style={{ width: `${reviewProgressPct}%` }}
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
            />
          </div>
          <span className="text-[11px] text-slate-500 block">
            {reviewedObsCount} of {observations.length} observations reviewed & audited
          </span>
        </div>
      </div>

      {/* 4b. Forensic Findings Dossier & Verification Report CTA */}
      <div className="bg-gradient-to-r from-blue-50/90 via-white to-slate-50 rounded-xl border border-blue-200/90 shadow-xs p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Forensic Verification Report & Methodology Dossier
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                {isAnalyzing ? "Compiling..." : "Ready"}
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Full evidentiary dossier with deterministic rule traces, SHA-256 pre-check records, cross-modal contradiction graphs, and unreviewed counts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            to={`/cases/${caseId}/report`}
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>View / Download Forensic Report</span>
          </Link>
          <a
            href={`/api/reports/${caseId}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>PDF</span>
          </a>
          <a
            href={`/api/reports/${caseId}.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>JSON</span>
          </a>
        </div>
      </div>

      {/* 5. Quick Modality Links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
          Specialized Inspection Workspaces
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Link
            to={`/cases/${caseId}/image`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <ImageIcon className="h-5 w-5 text-blue-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Image</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              {imageObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/video`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <Video className="h-5 w-5 text-sky-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Video</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              {videoObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/audio`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <Music className="h-5 w-5 text-emerald-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Audio</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              {audioObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/text`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <FileText className="h-5 w-5 text-amber-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Text</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              {textObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/graph`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <GitBranch className="h-5 w-5 text-blue-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Graph</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              {contradictionCount} Conflicts
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/timeline`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <Clock className="h-5 w-5 text-purple-600 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Timeline</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              Provenance
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/report`}
            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300 p-3 transition-all text-center space-y-1 group"
          >
            <FileSpreadsheet className="h-5 w-5 text-slate-700 mx-auto group-hover:scale-105 transition-transform" />
            <h4 className="text-xs font-bold text-slate-900">Report</h4>
            <span className="text-[10px] text-slate-500 font-mono block">
              Dossier & PDF
            </span>
          </Link>
        </div>
      </div>

      {/* 6. Evidence Inventory (EvidenceViewer) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Evidence Inventory ({evidenceItems.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-medium">
            SHA-256 Validated · Read-Only Store
          </span>
        </div>

        {evidenceItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
            No evidence files registered in this case yet.
          </div>
        ) : (
          <div className="space-y-4">
            {evidenceItems.map((ev) => (
              <EvidenceViewer
                key={ev.id}
                evidence={ev}
                onDeleted={loadCaseData}
                onVerified={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* 7. Forensic Indicators & Human Review Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Forensic Indicators & Human Review Controls ({observations.length})
            </h3>
          </div>
          <span className="text-xs text-slate-600 font-mono font-medium">
            {reviewedObsCount} of {observations.length} Reviewed
          </span>
        </div>

        <EvidenceStrengthLegend />

        {observations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-xs text-slate-500">
            No forensic observations generated yet. Click "Re-Run Analysis" above to execute the pipeline.
          </div>
        ) : (
          <div className="space-y-4">
            {observations.map((obs) => (
              <ObservationCard key={obs.id} observation={obs} onReviewed={loadCaseData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
