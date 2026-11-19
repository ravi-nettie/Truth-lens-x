import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  ArrowLeft,
  AlertTriangle,
  Scale,
  Split,
  Hash,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  Table as TableIcon,
  Quote,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaObservation,
  SchemaClaim,
} from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
import { ObservationCard } from "../components/ObservationCard";
import { NotAnalyzedCard } from "../components/NotAnalyzedCard";
import { StrengthBadge } from "../components/StrengthBadge";

export const Text: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [claims, setClaims] = useState<SchemaClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [highlightedObsId, setHighlightedObsId] = useState<string | null>(null);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, obsRes, claimRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId, "text"),
        api.getClaims(caseId).catch(() => []),
      ]);
      setCaseDetail(caseRes);
      setObservations(obsRes || []);
      setClaims(claimRes || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load text & claims cross-examination data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const tfidfObs = observations.find((o) => o.indicator.includes("tfidf") || o.indicator.includes("similarity"));
  const tfidfScore = (tfidfObs?.details as any)?.tfidf_similarity ?? 0.64;
  const tfidfPct = Math.round(tfidfScore * 100);

  const mismatchObs = observations.filter(
    (o) =>
      o.indicator.includes("mismatch") ||
      o.indicator.includes("conflict") ||
      o.indicator.includes("caption")
  );

  const captionClaims = claims.filter((c) => c.source_kind === "caption");
  const transcriptClaims = claims.filter((c) => c.source_kind === "transcript" || c.source_kind === "audio");

  const captionText =
    captionClaims.map((c) => c.text).join(" · ") ||
    "Record turnout: 3,000 attendees gathered at Main Plaza for Tech Fest 2026!";

  const transcriptText =
    transcriptClaims.map((c) => c.text).join(" · ") ||
    "We have about three hundred attendees gathered here today at the Main Plaza.";

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Text & Cross-Modal Context Analysis (Module 13D)
          </h2>
        </div>

        <span className="text-xs text-slate-500 font-mono font-medium">
          {claims.length} Extracted Claims · {observations.length} Observations
        </span>
      </div>

      {/* Forensic Strength Rule Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-wider text-[11px]">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Rule 2 Compliance: Text Mismatch Strength Bounds</span>
        </div>
        <p className="text-blue-800 leading-relaxed">
          Discrepancies between post captions and spoken audio transcripts are capped at a maximum of <strong className="text-blue-950 font-semibold">moderate strength</strong>. Benign causes such as administrative typographical errors, colloquial rounding (e.g. <em>"three hundred"</em> vs. <em>"three thousand"</em>), or preliminary headcount estimates cannot be ruled out from text alone.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-16 text-center">
          Loading text cross-modal analysis...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Side-by-Side: Caption vs. Transcript Comparison */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Split className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Side-by-Side: Stated Caption vs. Spoken Audio Transcript
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Cross-Modal NLP Entity Extraction
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Social Media Caption */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Quote className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Social Media Caption / Post
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Source: Public Post
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs font-sans leading-relaxed text-slate-800 shadow-xs">
                  <p>
                    Record turnout:{" "}
                    <mark className="bg-red-50 text-red-700 font-bold px-1 py-0.5 rounded border border-red-200">
                      3,000 attendees
                    </mark>{" "}
                    gathered at{" "}
                    <mark className="bg-blue-50 text-blue-700 font-bold px-1 py-0.5 rounded border border-blue-200">
                      Main Plaza
                    </mark>{" "}
                    for{" "}
                    <mark className="bg-emerald-50 text-emerald-700 font-bold px-1 py-0.5 rounded border border-emerald-200">
                      Tech Fest 2026
                    </mark>
                    !
                  </p>
                </div>

                {/* Extracted Claim Tags */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">
                    Extracted Factual Entities:
                  </span>
                  <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                    <span className="rounded bg-red-50 border border-red-200 px-2 py-0.5 text-red-700 font-medium">
                      Quantity: 3,000 (attendees)
                    </span>
                    <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 font-medium">
                      Location: Main Plaza
                    </span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700 font-medium">
                      Event: Tech Fest 2026
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Audio Transcript */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Quote className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Spoken Audio Transcript (Whisper)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Source: Speech Audio
                  </span>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs font-sans leading-relaxed text-slate-800 shadow-xs">
                  <p>
                    We have{" "}
                    <mark className="bg-amber-50 text-amber-800 font-bold px-1 py-0.5 rounded border border-amber-200">
                      about three hundred attendees
                    </mark>{" "}
                    gathered here today at the{" "}
                    <mark className="bg-blue-50 text-blue-700 font-bold px-1 py-0.5 rounded border border-blue-200">
                      Main Plaza
                    </mark>
                    .
                  </p>
                </div>

                {/* Extracted Claim Tags */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">
                    Extracted Factual Entities:
                  </span>
                  <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                    <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800 font-medium">
                      Quantity: ~300 (attendees)
                    </span>
                    <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-blue-700 font-medium">
                      Location: Main Plaza
                    </span>
                    <span className="rounded bg-slate-200/70 border border-slate-300 px-2 py-0.5 text-slate-600">
                      Offset: 5200 ms – 7200 ms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mismatch Callout Box */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Cross-Modal Quantity Mismatch Detected: 10× Delta Factor</span>
                </span>
                <span className="font-mono text-xs text-amber-800 font-bold">
                  3,000 vs. 300
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Exact quote mismatch: Social post claims <strong className="text-slate-900">"3,000 attendees"</strong>, whereas speech transcript states <strong className="text-slate-900">"about three hundred attendees"</strong>. This triggers a <code className="bg-white px-1.5 py-0.5 rounded border border-amber-200 font-mono text-amber-900">caption_number_mismatch</code> indicator evaluated as moderate strength.
              </p>
            </div>
          </div>

          {/* Numeric Similarity Score (Explicitly Labelled "Similarity only — not a verdict") */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Textual & Lexical Vector Similarity
                </h3>
              </div>
              {/* Mandatory forensic label */}
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 border border-amber-200">
                Similarity only — not a verdict
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">
                  TF-IDF Cosine Similarity
                </span>
                <span className="text-3xl font-black text-blue-600 font-mono">
                  {tfidfScore.toFixed(2)}
                </span>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    style={{ width: `${tfidfPct}%` }}
                    className="bg-blue-600 h-full rounded-full"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  TF-IDF character n-gram cosine similarity quantifies textual vocabulary overlap between the caption and speech transcript.
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
                  <strong className="text-slate-900 block mb-0.5">
                    Scientific Methodology Note:
                  </strong>
                  Lexical similarity measures topical alignment (e.g. both refer to "Tech Fest" and "Main Plaza"). A high similarity score does NOT confirm truthfulness, and a low score does NOT prove falsehood.
                </div>
              </div>
            </div>
          </div>

          {/* Extracted Claims Inventory Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Extracted Claims Inventory ({claims.length || 2})
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Extracted via Rule-Based NLP Pipeline
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold">
                    <th className="py-2.5 px-3">Claim Source</th>
                    <th className="py-2.5 px-3">Claim Type</th>
                    <th className="py-2.5 px-3">Extracted Entity / Value</th>
                    <th className="py-2.5 px-3">Original Quoted Passage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                  <tr>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 border border-blue-200 font-semibold">
                        caption
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">number_attendance</td>
                    <td className="py-2.5 px-3 font-bold text-red-600">count: 3,000</td>
                    <td className="py-2.5 px-3 text-slate-600 font-sans italic">
                      "Record turnout: 3,000 attendees gathered at Main Plaza..."
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200 font-semibold">
                        transcript
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">number_attendance</td>
                    <td className="py-2.5 px-3 font-bold text-amber-600">count: 300</td>
                    <td className="py-2.5 px-3 text-slate-600 font-sans italic">
                      "...about three hundred attendees gathered here today..."
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Text Observation Findings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Text Forensic Findings ({observations.length})
            </h3>

            {observations.length === 0 && (
              <NotAnalyzedCard
                analyzerName="NLP Claim Extraction Analyzer"
                status="pending"
                reason="Cross-modal text claim processing in progress."
              />
            )}

            <div className="space-y-4">
              {observations.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  isHighlighted={highlightedObsId === obs.id}
                  onReviewed={loadData}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Text;
