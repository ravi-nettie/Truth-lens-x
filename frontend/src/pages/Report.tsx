import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileSpreadsheet,
  ArrowLeft,
  Download,
  CheckCircle2,
  Lock,
  FileText,
  FileCheck2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Scale,
  Cpu,
  Layers,
  Hash,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaObservation,
  SchemaReportResponse,
  SchemaReviewResponse,
} from "../api/client";

export const Report: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();

  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [reviews, setReviews] = useState<SchemaReviewResponse[]>([]);
  const [reportResult, setReportResult] = useState<SchemaReportResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, obsRes, revRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId).catch(() => []),
        api.getCaseReviews(caseId).catch(() => ({ reviews: [] })),
      ]);
      setCaseDetail(caseRes);
      setObservations(obsRes || []);
      setReviews(revRes.reviews || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load case report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  // Review completeness metrics
  const reviewMap = new Map<string, string>();
  reviews.forEach((r) => {
    // latest decision per target
    if (!reviewMap.has(r.target_id)) {
      reviewMap.set(r.target_id, r.decision);
    }
  });

  let confirmedCount = 0;
  let dismissedCount = 0;
  let needsWorkCount = 0;
  let unreviewedCount = 0;

  observations.forEach((obs) => {
    const decision = reviewMap.get(obs.id);
    if (decision === "confirmed") confirmedCount++;
    else if (decision === "dismissed") dismissedCount++;
    else if (decision === "inconclusive") needsWorkCount++;
    else unreviewedCount++;
  });

  const totalObs = observations.length;
  const reviewedTotal = confirmedCount + dismissedCount + needsWorkCount;
  const reviewPct = totalObs > 0 ? Math.round((reviewedTotal / totalObs) * 100) : 100;

  // Handle report generation
  const handleGenerateReport = async () => {
    if (!caseId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await api.generateReport(caseId, "json");
      setReportResult(res);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate forensic report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyHashToClipboard = (hashStr: string) => {
    navigator.clipboard.writeText(hashStr);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to={`/cases/${caseId}`}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Case Dashboard
        </Link>
      </div>

      {/* Screen Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">
            Forensic Report & Methodology Dossier (Module 15)
          </h1>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Case Status: <strong className="text-white uppercase">{caseDetail?.case?.status || "Analyzing"}</strong>
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
          Loading forensic review completeness & dossier status...
        </div>
      ) : !caseDetail ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center text-xs text-slate-500">
          Case not found.
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Review Completeness Summary Card */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Analyst Review Completeness
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-800/60">
                {reviewPct}% Complete
              </span>
            </div>

            {/* Prominently displaying review completeness breakdown */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-base font-bold text-white">
                  "{confirmedCount} confirmed, {dismissedCount} dismissed, {unreviewedCount} unreviewed"
                </p>
                {needsWorkCount > 0 && (
                  <span className="text-xs text-amber-400 font-mono">
                    ({needsWorkCount} marked "Needs More Work")
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  style={{ width: `${reviewPct}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                />
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono">
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-2.5">
                  <span className="text-[10px] text-emerald-400 uppercase block font-semibold">
                    Confirmed
                  </span>
                  <span className="text-lg font-bold text-white">{confirmedCount}</span>
                </div>
                <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-2.5">
                  <span className="text-[10px] text-rose-400 uppercase block font-semibold">
                    Dismissed
                  </span>
                  <span className="text-lg font-bold text-white">{dismissedCount}</span>
                </div>
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-2.5">
                  <span className="text-[10px] text-amber-400 uppercase block font-semibold">
                    Needs More Work
                  </span>
                  <span className="text-lg font-bold text-white">{needsWorkCount}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                    Unreviewed
                  </span>
                  <span className="text-lg font-bold text-slate-300">{unreviewedCount}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Generate Report Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tamper-Evident Report Generation
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                Rendered Strictly from SQLite WAL Rows
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Generates a reproducible forensic verification dossier. All original evidence SHA-256 hashes, analyzer findings, alternative explanations, and reviewer determinations are compiled into an immutable JSON document and a styled ReportLab PDF.
            </p>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 text-xs transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                <span>{isGenerating ? "Compiling Report..." : "Generate Report"}</span>
              </button>

              {(reportResult || caseDetail.case.status === "reported") && (
                <>
                  <a
                    href={reportResult?.pdf_url || `/api/reports/${caseId}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </a>

                  <a
                    href={reportResult?.json_url || `/api/reports/${caseId}.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download JSON</span>
                  </a>
                </>
              )}
            </div>

            {/* Report SHA-256 Digest Callout */}
            {reportResult && (
              <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-4 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Report Sealed · SHA-256 Cryptographic Hash
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ID: {reportResult.report_id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-slate-950 p-2.5 rounded border border-slate-800">
                  <code className="text-xs text-indigo-300 font-mono break-all select-all">
                    {reportResult.report_json_sha256 || "Digest calculating..."}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyHashToClipboard(reportResult.report_json_sha256 || "")}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-slate-700 shrink-0 font-mono"
                  >
                    {copiedHash ? "Copied!" : "Copy Hash"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 3. Dedicated System Limitations & Methodology Section */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 shadow-sm">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  System Limitations & Methodology Specification
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Rigorous scientific disclosure of technical boundaries, error categories, and false-positive controls.
              </p>
            </div>

            {/* The 5 Forensic Uncertainty Categories */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span>The 5 Uncertainty Categories</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                  <span className="font-mono text-indigo-400 font-bold text-[10px] uppercase">
                    1. measurement (Hardware & Acquisition)
                  </span>
                  <h5 className="font-semibold text-white text-xs">Sensor & Acoustic Capture</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Camera Bayer CFA interpolation, CMOS rolling shutter, optical chromatic aberration, and physical microphone wind buffeting produce signal variations independent of intentional tampering.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                  <span className="font-mono text-indigo-400 font-bold text-[10px] uppercase">
                    2. model (Algorithmic Uncertainty)
                  </span>
                  <h5 className="font-semibold text-white text-xs">Uncalibrated Neural Outputs</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Classifiers trained on bounded benchmarks output raw logits that degrade on wild media. TruthLens X mandates <code className="bg-slate-900 text-amber-300 px-1 py-0.2 rounded font-mono">model_calibrated=False</code> and labels them "uncalibrated model output".
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                  <span className="font-mono text-indigo-400 font-bold text-[10px] uppercase">
                    3. interpretation (Semantic Uncertainty)
                  </span>
                  <h5 className="font-semibold text-white text-xs">Conversational & Figurative Claims</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Spoken rhetoric often utilizes colloquial rounding (e.g. <em>"three hundred attendees"</em>) or informal estimates that conflict numerically with administrative caption headcounts without intent to forge.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-1">
                  <span className="font-mono text-indigo-400 font-bold text-[10px] uppercase">
                    4. coverage (Signal Incompleteness)
                  </span>
                  <h5 className="font-semibold text-white text-xs">Absence of Counter-Angles</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Social networks (WhatsApp, X) strip EXIF tags by default. A lack of corroborating independent camera perspectives prevents 3D geometric reconstruction.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 space-y-1 md:col-span-2">
                  <span className="font-mono text-indigo-400 font-bold text-[10px] uppercase">
                    5. transcription (Acoustic ASR Uncertainty)
                  </span>
                  <h5 className="font-semibold text-white text-xs">Whisper int8 Speech-to-Text Bounds</h5>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Faster-Whisper quantized to int8 executes efficiently on laptop CPUs, but ambient reverberation, crowd chatter, or accent variations can cause phonetic drops. Transcripts must be verified against primary audio.
                  </p>
                </div>
              </div>
            </div>

            {/* Known False-Positive Risks per Indicator */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>Known False-Positive Risks per Forensic Indicator</span>
              </h4>

              <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono">
                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">Missing EXIF Metadata</span>
                    <p className="text-slate-400 font-sans text-[11px]">
                      Nearly all messaging platforms sanitize EXIF for user privacy. Evaluated strictly as <strong>informational</strong>, never as evidence of forgery.
                    </p>
                  </div>
                  <span className="text-[10px] text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800 shrink-0">
                    Informational Tier
                  </span>
                </div>

                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">Video Hard Scene Cut (HSV Delta)</span>
                    <p className="text-slate-400 font-sans text-[11px]">
                      Standard multi-camera editing or mobile pause-and-resume. Only evaluated as suspicious when synchronized with an audio phase jump or conflicting claim.
                    </p>
                  </div>
                  <span className="text-[10px] text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800 shrink-0">
                    Informational Tier
                  </span>
                </div>

                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">Error Level Analysis (ELA) Variance</span>
                    <p className="text-slate-400 font-sans text-[11px]">
                      High-contrast geometric edges and multiple social media compression re-saves generate prominent ELA gradients naturally.
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 shrink-0">
                    Weak / Moderate
                  </span>
                </div>

                <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white">SIFT Keypoint Clustering (Copy-Move)</span>
                    <p className="text-slate-400 font-sans text-[11px]">
                      Dense crowd apparel, promotional logos, building facades, and patterned textures frequently trigger keypoint match clusters.
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800 shrink-0">
                    Moderate (Capped)
                  </span>
                </div>
              </div>
            </div>

            {/* Security, Privacy & Local-First Boundaries */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-400" />
                <span>Security, Privacy & Local-First Boundaries</span>
              </h4>
              <ul className="space-y-1 text-slate-300 list-disc list-inside text-[11px] leading-relaxed">
                <li>
                  <strong>100% Offline:</strong> Operates strictly on local laptop CPUs without outbound network requests or third-party cloud APIs.
                </li>
                <li>
                  <strong>Read-Only Evidence Store:</strong> Uploaded originals are set to file mode <code className="bg-slate-900 px-1 py-0.2 rounded font-mono text-emerald-400">0444</code> immediately upon ingestion and never altered.
                </li>
                <li>
                  <strong>Deterministic SQLite WAL:</strong> All analyzer observations, edge correlations, and reviewer verdicts reside in an append-only, tamper-evident audit database.
                </li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Report;
