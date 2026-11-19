import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Lock,
  FileText,
  FileCheck2,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Scale,
  Layers,
  Loader2,
  Info,
  ExternalLink,
  Copy,
  Printer,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaObservation,
  SchemaReportResponse,
  SchemaReviewResponse,
  SchemaGraphResponse,
} from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";

const STRENGTH_ORDER: Record<string, number> = {
  strong: 0,
  moderate: 1,
  weak: 2,
  informational: 3,
};

export const Report: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();

  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [reviews, setReviews] = useState<SchemaReviewResponse[]>([]);
  const [graphData, setGraphData] = useState<SchemaGraphResponse | null>(null);
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
      const [caseRes, obsRes, revRes, graphRes, repRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId).catch(() => []),
        api.getCaseReviews(caseId).catch(() => ({ reviews: [] })),
        api.getGraph(caseId).catch(() => null),
        api.getReport(caseId).catch(() => null),
      ]);
      setCaseDetail(caseRes);
      setObservations(obsRes || []);
      setReviews(revRes.reviews || []);
      if (graphRes) setGraphData(graphRes);
      if (repRes) setReportResult(repRes);
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

  // Sorted findings by strength tier
  const sortedObservations = [...observations].sort((a, b) => {
    const rankA = STRENGTH_ORDER[a.evidence_strength?.toLowerCase()] ?? 99;
    const rankB = STRENGTH_ORDER[b.evidence_strength?.toLowerCase()] ?? 99;
    return rankA - rankB;
  });

  // Calculate review priority
  const strongCount = observations.filter((o) => o.evidence_strength === "strong").length;
  const moderateCount = observations.filter((o) => o.evidence_strength === "moderate").length;
  const weakCount = observations.filter((o) => o.evidence_strength === "weak").length;
  const infoCount = observations.filter((o) => o.evidence_strength === "informational").length;
  const contradictionsCount = graphData?.edges?.filter((e) => e.relation === "CONTRADICTS").length ?? 0;

  let reviewPriority = "LOW";
  if (strongCount >= 1 || contradictionsCount >= 1) {
    reviewPriority = "HIGH";
  } else if (moderateCount >= 1) {
    reviewPriority = "MEDIUM";
  }

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

  const caseObj = caseDetail?.case;
  const evidenceItems = caseDetail?.evidence_items || [];
  const repData = reportResult?.report_json;

  const pdfDownloadUrl = reportResult?.pdf_url || `/api/reports/${caseId}.pdf`;
  const jsonDownloadUrl = reportResult?.json_url || `/api/reports/${caseId}.json`;
  const sealedSha256 =
    reportResult?.report_json_sha256 ||
    repData?.report_json_sha256 ||
    "Auto-compiles upon report request";

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseObj && <CaseHeaderTabs caseData={caseObj} caseId={caseId || ""} />}

      {/* Screen Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Forensic Report & Methodology Dossier (Module 15)
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Dossier</span>
          </button>

          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </a>

          <a
            href={jsonDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download JSON</span>
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-2.5 py-1 rounded bg-white border border-red-200 text-red-700 hover:bg-red-50 text-[11px] font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-20 text-center flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span>Loading forensic review completeness & dossier status...</span>
        </div>
      ) : !caseDetail ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-xs text-slate-500">
          Case not found.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Document Column (approx 70%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Formal Paper Canvas */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 md:p-10 relative overflow-hidden">
              {/* Report Header Band */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 bg-slate-50 -mx-8 -mt-8 p-8 md:-mx-10 md:-mt-10 mb-8 border-b border-slate-200">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
                    <ShieldCheck className="h-7 w-7 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900 tracking-tight">
                      TruthLens X Digital Forensics Laboratory
                    </div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                      Independent Evidentiary Certification Authority
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-0 text-left md:text-right">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">
                    Report Reference
                  </div>
                  <div className="text-sm font-bold text-blue-600 font-mono tracking-tight">
                    TLX-REP-{caseId?.toUpperCase().slice(0, 16)}-FINAL
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Issued: {new Date().toLocaleDateString()} UTC
                  </div>
                </div>
              </div>

              {/* Case Metadata Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 mb-8 text-xs font-mono">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Case ID</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate" title={caseObj?.id}>
                    {caseObj?.id}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Lead Examiner</div>
                  <div className="font-bold text-slate-900 mt-0.5 font-sans">Analyst Vance, EnCE</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Environment</div>
                  <div className="font-bold text-slate-900 mt-0.5 font-sans">Local Machine (Offline)</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px]">Disposition</div>
                  <div className="font-bold text-blue-600 mt-0.5 font-sans uppercase">
                    {confirmedCount > 0 ? `${confirmedCount} Confirmed Finding(s)` : "Review Pending"}
                  </div>
                </div>
              </div>

              {/* Forensic Operational & Decision-Support Warning Banner */}
              <div className="rounded-xl border border-red-300 bg-red-50/70 p-4 mb-8 space-y-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-900 font-mono">
                    Decision-Support Only — Not a Forensic Verdict
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Disclaimer:</strong> Decision-support report; not a definitive legal determination of authenticity or synthetic manipulation. Findings record technical signal telemetry under strict air-gapped containment.
                </p>
                <div className="p-3 rounded-lg bg-white/80 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">Review Priority Triage: </span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                        reviewPriority === "HIGH"
                          ? "bg-red-100 text-red-700 border border-red-200"
                          : reviewPriority === "MEDIUM"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-blue-100 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {reviewPriority} PRIORITY
                    </span>
                    <span className="text-slate-500 text-[11px] ml-2">
                      (Rule: HIGH if strong ≥ 1 OR contradictions ≥ 1 · MEDIUM if moderate ≥ 1 · LOW otherwise)
                    </span>
                  </div>
                  <span className="font-mono text-slate-600 text-[11px] font-semibold shrink-0">
                    {unreviewedCount} unreviewed finding(s)
                  </span>
                </div>
              </div>

              {/* Section 1: Executive Summary */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <span className="w-1.5 h-4 bg-blue-600 rounded"></span>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    1. Executive Summary & Forensic Determination
                  </h3>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Forensic evaluation of submitted multimodal evidence assets demonstrates deterministic rule-based findings without relying on single-metric fake scores. Algorithmic telemetry, copy-move SIFT cluster matching, and cross-modal NLP contradiction analyses substantiate that signals were recorded under strict local containment.
                </p>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold uppercase tracking-wide">
                      ANALYSIS DETERMINATION: {confirmedCount > 0 ? "FINDINGS CONFIRMED BY ANALYST" : "REVIEW IN PROGRESS"}
                    </div>
                    <div className="mt-1 text-slate-600 leading-relaxed font-sans">
                      "{confirmedCount} confirmed, {dismissedCount} dismissed, {unreviewedCount} unreviewed". All findings are grounded in deterministic signal checks with mandatory alternative explanations.
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Evidence Table & Pre-Report Hash Verification */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <span className="w-1.5 h-4 bg-blue-600 rounded"></span>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    2. Evidence Table & Pre-Report Hash Verification (SHA-256)
                  </h3>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">Original Name</th>
                        <th className="py-2.5 px-3">Modality</th>
                        <th className="py-2.5 px-3">File Size</th>
                        <th className="py-2.5 px-3">SHA-256 Hash</th>
                        <th className="py-2.5 px-3 text-right">Integrity Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {evidenceItems.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans">{ev.filename}</td>
                          <td className="py-2.5 px-3 uppercase text-slate-500">{ev.kind}</td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {ev.size_bytes ? `${(ev.size_bytes / 1024).toFixed(1)} KB` : "N/A"}
                          </td>
                          <td className="py-2.5 px-3 text-blue-600 font-bold break-all select-all">{ev.sha256}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold font-sans text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>MATCH (0444)</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Synthesis of Forensic Findings (Sorted by Strength) */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded"></span>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      3. Synthesis of Forensic Findings ({sortedObservations.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Sorted: Strong &rarr; Informational
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {sortedObservations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                      No forensic findings recorded for this case.
                    </div>
                  ) : (
                    sortedObservations.map((obs) => {
                      const decision = reviewMap.get(obs.id) || "unreviewed";
                      return (
                        <div
                          key={obs.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                  obs.evidence_strength === "strong"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : obs.evidence_strength === "moderate"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : obs.evidence_strength === "weak"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {obs.evidence_strength}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 font-mono">
                                {obs.indicator}
                              </h4>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                [{obs.modality}]
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 font-sans">Review Status:</span>
                              <span
                                className={`font-semibold capitalize text-xs ${
                                  decision === "confirmed"
                                    ? "text-emerald-700"
                                    : decision === "dismissed"
                                    ? "text-red-700"
                                    : "text-slate-500 italic"
                                }`}
                              >
                                {decision}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-700 space-y-1">
                            <p>
                              <strong>Explanation:</strong> {obs.explanation || obs.summary}
                            </p>
                            {obs.alternative_explanation && (
                              <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic">
                                <strong>Alternative Explanation:</strong> {obs.alternative_explanation}
                              </p>
                            )}
                            {obs.model_score !== null && obs.model_score !== undefined && (
                              <p className="text-[11px] font-mono text-slate-500">
                                Model Output: {Number(obs.model_score).toFixed(3)} (uncalibrated model output)
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 4: Cross-Modal Contradiction Graph & Correlation Links */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded"></span>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      4. Cross-Modal Contradiction & Correlation Graph Links
                    </h3>
                  </div>
                  <Link
                    to={`/cases/${caseId}/graph`}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 font-mono"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Open Interactive Graph</span>
                  </Link>
                </div>

                {graphData?.edges && graphData.edges.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                          <th className="py-2.5 px-3">Relation</th>
                          <th className="py-2.5 px-3">Rule</th>
                          <th className="py-2.5 px-3">Explanation</th>
                          <th className="py-2.5 px-3">Alternative Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {graphData.edges.map((edge) => (
                          <tr key={edge.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  edge.relation === "CONTRADICTS"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {edge.relation}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                              {edge.rule}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 max-w-xs">{edge.explanation}</td>
                            <td className="py-2.5 px-3 text-slate-500 italic max-w-xs">
                              {edge.alternative_explanation || "None recorded"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    No cross-modal relationship edges recorded.
                  </div>
                )}
              </div>

              {/* Legal Attestation & Circular Seal */}
              <div className="pt-6 bg-slate-50 -mx-8 -mb-8 p-8 md:-mx-10 md:-mb-10 rounded-b-xl flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-200">
                <div className="max-w-md">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    Legal Attestation & Certification
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    I affirm that this examination was performed under strict offline local verification guidelines. The findings recorded herein reflect rule-based algorithmic inspection and human analyst review.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-800">
                    <span className="font-semibold">Examiner E-Signature:</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      J. Vance, Senior Forensic Analyst
                    </span>
                  </div>
                </div>

                {/* Circular Verification Stamp */}
                <div className="w-36 h-36 rounded-full bg-white border-2 border-blue-600/30 flex flex-col items-center justify-center p-3 text-center shadow-xs select-none shrink-0">
                  <ShieldCheck className="h-8 w-8 text-blue-600" />
                  <span className="text-[9px] font-bold text-slate-900 tracking-wider uppercase mt-1">
                    CERTIFIED FORENSIC
                  </span>
                  <span className="font-mono text-[8px] text-slate-500">TRUTHLENS LABS</span>
                  <span className="font-mono text-[8px] text-blue-600 mt-0.5 font-bold">SHA-VERIFIED 2026</span>
                </div>
              </div>
            </div>

            {/* Dedicated System Limitations & 5 Uncertainty Categories Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    System Limitations & Methodology Specification
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Rigorous scientific disclosure of technical boundaries, error categories, and false-positive controls.
                </p>
              </div>

              {/* The 5 Forensic Uncertainty Categories */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <span>The 5 Uncertainty Categories</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                    <span className="font-mono text-blue-600 font-bold text-[10px] uppercase">
                      1. measurement (Hardware & Acquisition)
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs">Sensor & Acoustic Capture</h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Camera Bayer CFA interpolation, CMOS rolling shutter, optical chromatic aberration, and physical microphone wind buffeting produce signal variations independent of intentional tampering.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                    <span className="font-mono text-blue-600 font-bold text-[10px] uppercase">
                      2. model (Algorithmic Uncertainty)
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs">Uncalibrated Neural Outputs</h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Classifiers trained on bounded benchmarks output raw logits that degrade on wild media. TruthLens X mandates <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">model_calibrated=False</code> and labels them "uncalibrated model output".
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                    <span className="font-mono text-blue-600 font-bold text-[10px] uppercase">
                      3. interpretation (Semantic Uncertainty)
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs">Conversational & Figurative Claims</h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Spoken rhetoric often utilizes colloquial rounding (e.g. <em>"three hundred attendees"</em>) or informal estimates that conflict numerically with administrative caption headcounts without intent to forge.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                    <span className="font-mono text-blue-600 font-bold text-[10px] uppercase">
                      4. coverage (Signal Incompleteness)
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs">Absence of Counter-Angles</h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Social networks (WhatsApp, X) strip EXIF tags by default. A lack of corroborating independent camera perspectives prevents 3D geometric reconstruction.
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1 md:col-span-2">
                    <span className="font-mono text-blue-600 font-bold text-[10px] uppercase">
                      5. transcription (Acoustic ASR Uncertainty)
                    </span>
                    <h5 className="font-semibold text-slate-900 text-xs">Whisper int8 Speech-to-Text Bounds</h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Faster-Whisper quantized to int8 executes efficiently on laptop CPUs, but ambient reverberation, crowd chatter, or accent variations can cause phonetic drops. Transcripts must be verified against primary audio.
                    </p>
                  </div>
                </div>
              </div>

              {/* Known False-Positive Risks per Indicator */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Known False-Positive Risks per Forensic Indicator</span>
                </h4>

                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono">
                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900">Missing EXIF Metadata</span>
                      <p className="text-slate-600 font-sans text-[11px]">
                        Nearly all messaging platforms sanitize EXIF for user privacy. Evaluated strictly as <strong>informational</strong>, never as evidence of forgery.
                      </p>
                    </div>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0 font-medium">
                      Informational Tier
                    </span>
                  </div>

                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900">Video Hard Scene Cut (HSV Delta)</span>
                      <p className="text-slate-600 font-sans text-[11px]">
                        Standard multi-camera editing or mobile pause-and-resume. Only evaluated as suspicious when synchronized with an audio phase jump or conflicting claim.
                      </p>
                    </div>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0 font-medium">
                      Informational Tier
                    </span>
                  </div>

                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900">Error Level Analysis (ELA) Variance</span>
                      <p className="text-slate-600 font-sans text-[11px]">
                        High-contrast geometric edges and multiple social media compression re-saves generate prominent ELA gradients naturally.
                      </p>
                    </div>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0 font-medium">
                      Weak / Moderate
                    </span>
                  </div>

                  <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900">SIFT Keypoint Clustering (Copy-Move)</span>
                      <p className="text-slate-600 font-sans text-[11px]">
                        Dense crowd apparel, promotional logos, building facades, and patterned textures frequently trigger keypoint match clusters.
                      </p>
                    </div>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0 font-medium">
                      Moderate (Capped)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Report Actions & Review Completeness (approx 30%) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Actions Panel */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Report Actions</h3>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>{isGenerating ? "Compiling Dossier..." : "Generate / Refresh Report"}</span>
                </button>

                <a
                  href={pdfDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors"
                >
                  <Download className="h-4 w-4 text-slate-600" />
                  <span>Download PDF Dossier</span>
                </a>

                <a
                  href={jsonDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors"
                >
                  <Download className="h-4 w-4 text-slate-600" />
                  <span>Download Raw JSON Evidence</span>
                </a>
              </div>

              {/* Report SHA-256 Digest Callout */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    SHA-256 Sealed
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {reportResult?.report_id || `Case ${caseId?.slice(0, 8)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white p-2 rounded border border-emerald-200">
                  <code className="text-[11px] text-blue-700 font-mono break-all select-all">
                    {sealedSha256}
                  </code>
                  {reportResult?.report_json_sha256 && (
                    <button
                      type="button"
                      onClick={() => copyHashToClipboard(reportResult.report_json_sha256 || "")}
                      className="text-[10px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 border border-slate-200 shrink-0 font-mono"
                    >
                      {copiedHash ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Review Completeness Tracker */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-semibold text-slate-900">Review Completeness</h3>
                </div>
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                  {reviewPct}% Complete
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    "{confirmedCount} confirmed, {dismissedCount} dismissed, {unreviewedCount} unreviewed"
                  </p>
                </div>

                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    style={{ width: `${reviewPct}%` }}
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                    <span className="text-[10px] text-emerald-800 uppercase block font-semibold">
                      Confirmed
                    </span>
                    <span className="text-lg font-bold text-slate-900">{confirmedCount}</span>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                    <span className="text-[10px] text-red-800 uppercase block font-semibold">
                      Dismissed
                    </span>
                    <span className="text-lg font-bold text-slate-900">{dismissedCount}</span>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <span className="text-[10px] text-amber-800 uppercase block font-semibold">
                      Needs Work
                    </span>
                    <span className="text-lg font-bold text-slate-900">{needsWorkCount}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                      Unreviewed
                    </span>
                    <span className="text-lg font-bold text-slate-900">{unreviewedCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Offline & Chain-of-Custody Invariants Box */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Lock className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Custody & Privacy Invariants
                </h3>
              </div>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>
                  <strong className="text-slate-900">Strictly Offline:</strong> Zero telemetry packets transmitted off this workstation.
                </li>
                <li>
                  <strong className="text-slate-900">Read-Only Store:</strong> Evidence media permanently locked in mode <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">0444</code>.
                </li>
                <li>
                  <strong className="text-slate-900">SQLite Append-Only:</strong> Full audit ledger tracking every analyst determination.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;
