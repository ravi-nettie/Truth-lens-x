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
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaObservation,
  SchemaEvidenceResponse,
  SchemaAnalysisStatusResponse,
} from "../api/client";
import { StatusBar } from "../components/StatusBar";
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

      if (cRes.case.status === "analyzing") {
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

  // Polling effect every 1.5s while analyzing
  useEffect(() => {
    if (!caseId || !isAnalyzing) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const st = await api.getCaseStatus(caseId);
        setStatusInfo(st);
        if (st.status === "completed" || (st.progress_percent ?? 0) >= 100) {
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
      <div className="flex h-96 items-center justify-center text-xs text-slate-400 font-mono">
        <Loader2 className="h-5 w-5 animate-spin mr-2 text-indigo-500" />
        Loading case dashboard...
      </div>
    );
  }

  if (!caseDetail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">Case Not Found</h2>
        <p className="text-xs text-slate-400 mt-1">{errorMsg || `Case ID "${caseId}" does not exist.`}</p>
        <Link to="/" className="inline-block mt-4 text-xs font-semibold text-indigo-400 hover:underline">
          Return to Overview
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
  let priorityStyle = "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
  let priorityReason = "No strong evidence anomalies or cross-modal contradictions detected.";

  if (strongCount >= 1 || contradictionCount >= 1) {
    priorityLabel = "HIGH REVIEW PRIORITY";
    priorityStyle = "bg-rose-950/80 text-rose-300 border-rose-600/70";
    priorityReason = `${strongCount} strong anomaly finding(s) and ${contradictionCount} cross-modal contradiction(s) require human review.`;
  } else if (moderateCount >= 1) {
    priorityLabel = "MEDIUM REVIEW PRIORITY";
    priorityStyle = "bg-amber-950/80 text-amber-300 border-amber-600/70";
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header & Priority Callout */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {c.id}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>
                {priorityLabel}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Created: {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{c.title}</h1>
            {c.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {c.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-2 rounded-lg text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Play className="h-4 w-4 fill-white" />
              )}
              <span>{isAnalyzing ? "Analyzing Pipeline..." : "Re-Run Analysis"}</span>
            </button>
          </div>
        </div>

        {/* Priority Formula Explainer */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Review Priority Formula:</strong> HIGH if (strong ≥ 1 OR contradictions ≥ 1) · MEDIUM if (moderate ≥ 1) · LOW otherwise.
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px] italic">
            {priorityReason}
          </span>
        </div>

        {/* 5-Stage Status Bar */}
        <StatusBar status={c.status || "created"} />

        {isAnalyzing && (
          <div className="rounded-lg border border-indigo-800/60 bg-indigo-950/30 p-3 text-xs text-indigo-300 flex items-center justify-between animate-pulse">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Analyzing multimodal media on local CPU (polling every 1.5 s)...</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {statusInfo?.current_step || "Running pipeline analyzers..."}
            </span>
          </div>
        )}
      </section>

      {/* 2. Per-Analyzer Run Status Badges */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Per-Analyzer Execution Status</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            Rule-Based Pipeline (Pure Functions)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ANALYZER_CATALOG.map((analyzer) => {
            // Check if there are observations matching this analyzer
            const matchingObs = observations.filter(
              (o) =>
                o.method.toLowerCase().includes(analyzer.key) ||
                o.indicator.toLowerCase().includes(analyzer.key)
            );
            const isCompleted = matchingObs.length > 0 || c.status === "correlated" || c.status === "reported";
            const isFailed = statusInfo?.errors?.some((e) => e.toLowerCase().includes(analyzer.key));

            return (
              <div
                key={analyzer.key}
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-[11px] font-semibold text-slate-200 block truncate">
                    {analyzer.name}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">
                    {analyzer.modality}
                  </span>
                </div>
                <span
                  className={`flex h-2.5 w-2.5 rounded-full ${
                    isFailed
                      ? "bg-rose-500 ring-2 ring-rose-500/30"
                      : isCompleted
                      ? "bg-emerald-400 ring-2 ring-emerald-400/30"
                      : isAnalyzing
                      ? "bg-indigo-400 animate-ping"
                      : "bg-slate-600"
                  }`}
                  title={isFailed ? "Failed" : isCompleted ? "Completed" : "Pending"}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Summary Counts of Findings & Review Progress */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Findings Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Total Indicators
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{observations.length}</span>
            <span className="text-xs text-slate-400">observations</span>
          </div>
          <div className="flex gap-2 text-[10px] font-mono pt-1 text-slate-400">
            <span className="text-rose-400">{strongCount} strong</span>
            <span>·</span>
            <span className="text-amber-400">{moderateCount} moderate</span>
            <span>·</span>
            <span className="text-sky-400">{weakCount} weak</span>
          </div>
        </div>

        {/* Contradictions Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Cross-Modal Contradictions
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${contradictionCount > 0 ? "text-amber-400" : "text-white"}`}>
              {contradictionCount}
            </span>
            <span className="text-xs text-slate-400">conflict edges</span>
          </div>
          <p className="text-[10px] text-slate-500 pt-1 leading-snug">
            {contradictionCount > 0
              ? "Signals conflict across independent modalities."
              : "No conflicting cross-modal signals."}
          </p>
        </div>

        {/* Evidence Ingested Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Ingested Evidence Items
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{evidenceItems.length}</span>
            <span className="text-xs text-slate-400">files</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 block pt-1">
            Mode 0444 · Read-Only Store
          </span>
        </div>

        {/* Human Review Progress Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Human Review Progress</span>
            <span className="text-indigo-400 font-bold">{reviewProgressPct}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              style={{ width: `${reviewProgressPct}%` }}
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 block pt-0.5">
            {reviewedObsCount} of {observations.length} observations reviewed & audited
          </span>
        </div>
      </section>

      {/* 4. Quick Modality Links (Modules 13A - 15) */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
          Inspection Modules & Specialized Views
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Link
            to={`/cases/${caseId}/image`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <ImageIcon className="h-5 w-5 text-indigo-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Image (13A)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              {imageObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/video`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <Video className="h-5 w-5 text-sky-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Video (13B)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              {videoObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/audio`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <Music className="h-5 w-5 text-emerald-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Audio (13C)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              {audioObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/text`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <FileText className="h-5 w-5 text-amber-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Text (13D)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              {textObsCount} Findings
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/graph`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <GitBranch className="h-5 w-5 text-indigo-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Graph (14A)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              {contradictionCount} Conflicts
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/timeline`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <Clock className="h-5 w-5 text-purple-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Timeline (14B)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              Temporal Sync
            </span>
          </Link>

          <Link
            to={`/cases/${caseId}/report`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center space-y-1 group"
          >
            <FileSpreadsheet className="h-5 w-5 text-rose-400 mx-auto group-hover:scale-110 transition-transform" />
            <h4 className="text-xs font-bold text-white">Report (15)</h4>
            <span className="text-[10px] text-slate-400 font-mono block">
              Dossier & PDF
            </span>
          </Link>
        </div>
      </section>

      {/* 5. Evidence Inventory (EvidenceViewer) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Evidence Inventory ({evidenceItems.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
            All files hashed with SHA-256 upon ingestion
          </span>
        </div>

        {evidenceItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center text-xs text-slate-500">
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
      </section>

      {/* 6. Forensic Indicators & Human Review Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Forensic Indicators & Human Review Controls ({observations.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {reviewedObsCount} Reviewed
          </span>
        </div>

        <EvidenceStrengthLegend />

        {observations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-xs text-slate-500">
            No forensic observations generated yet. Click "Re-Run Analysis" above to execute the pipeline.
          </div>
        ) : (
          <div className="space-y-4">
            {observations.map((obs) => (
              <ObservationCard key={obs.id} observation={obs} onReviewed={loadCaseData} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
