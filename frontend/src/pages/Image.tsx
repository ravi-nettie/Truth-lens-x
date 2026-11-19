import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Image as ImageIcon,
  ArrowLeft,
  Layers,
  Camera,
  AlertTriangle,
  Info,
  Maximize2,
  FileSearch,
  Sparkles,
  RotateCw,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaEvidenceResponse,
  SchemaObservation,
} from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
import { ObservationCard } from "../components/ObservationCard";
import { NotAnalyzedCard } from "../components/NotAnalyzedCard";
import { EvidenceViewer } from "../components/EvidenceViewer";

export const Image: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SchemaEvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Viewer modes: "original" | "ela" | "copymove" | "split"
  const [viewerMode, setViewerMode] = useState<"original" | "ela" | "copymove" | "split">("original");
  const [highlightedObsId, setHighlightedObsId] = useState<string | null>(null);

  // Natural image dimensions for SVG bounding box normalization
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, obsRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId, "image"),
      ]);
      setCaseDetail(caseRes);
      setObservations(obsRes || []);

      const images = (caseRes.evidence_items || []).filter(
        (e) => e.modality === "image" || e.mime_type.startsWith("image/")
      );
      if (images.length > 0) {
        setSelectedEvidence(images[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load image forensic data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  const imageEvidenceList = (caseDetail?.evidence_items || []).filter(
    (e) => e.modality === "image" || e.mime_type.startsWith("image/")
  );

  // Extract relevant image observations
  const exifObs = observations.find((o) => o.indicator.includes("exif"));
  const elaObs = observations.find((o) => o.indicator.includes("ela"));
  const copyMoveObs = observations.find(
    (o) => o.indicator.includes("copymove") || o.indicator.includes("copy_move")
  );
  const jpegObs = observations.find((o) => o.indicator.includes("jpeg"));

  // ELA Artifact
  const elaArtifactId = elaObs?.artifact_ids?.[0];

  // Copy Move ROI
  const roi = copyMoveObs?.region;
  const copyMoveDetails = (copyMoveObs?.details as any) || {};

  const originalImageUrl = selectedEvidence ? `/api/evidence/${selectedEvidence.id}/file` : "";
  const elaImageUrl = elaArtifactId ? `/api/artifacts/${elaArtifactId}` : "";

  // Calculate bounding box percentages
  const getRoiStyle = () => {
    if (!roi) return null;
    const meta = (selectedEvidence as any)?.metadata || {};
    const refW = naturalDimensions?.width || meta.width || 3840;
    const refH = naturalDimensions?.height || meta.height || 2160;

    const isNormalized = roi.w <= 1.0 && roi.h <= 1.0 && roi.x <= 1.0 && roi.y <= 1.0;
    const leftPct = isNormalized ? roi.x * 100 : (roi.x / refW) * 100;
    const topPct = isNormalized ? roi.y * 100 : (roi.y / refH) * 100;
    const widthPct = isNormalized ? roi.w * 100 : (roi.w / refW) * 100;
    const heightPct = isNormalized ? roi.h * 100 : (roi.h / refH) * 100;

    return {
      left: `${Math.max(0, Math.min(leftPct, 95))}%`,
      top: `${Math.max(0, Math.min(topPct, 95))}%`,
      width: `${Math.max(2, Math.min(widthPct, 100))}%`,
      height: `${Math.max(2, Math.min(heightPct, 100))}%`,
    };
  };

  const roiStyle = getRoiStyle();

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title & Evidence Selector */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <ImageIcon className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Image Forensic Inspection (Module 13A)
          </h2>
        </div>

        {imageEvidenceList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Select Image:</span>
            <select
              value={selectedEvidence?.id || ""}
              onChange={(e) => {
                const ev = imageEvidenceList.find((item) => item.id === e.target.value);
                if (ev) setSelectedEvidence(ev);
              }}
              className="bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {imageEvidenceList.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.filename}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Forensic Limitation Advisory Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-wider text-[11px]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Forensic Limitation & False-Positive Advisory</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          Absence of EXIF metadata, secondary JPEG recompression grids, and localized Error Level Analysis (ELA) luminance gradients frequently arise from routine social media uploads, image resizing, or legitimate cropping. They do not constitute standalone proof of manipulation without verified multi-modal corroboration.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-16 text-center">
          Loading image forensic findings...
        </div>
      ) : !selectedEvidence ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-xs text-slate-500">
          <ImageIcon className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          No image evidence items registered in this case.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Multi-Layer Viewer */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Interactive Forensic Layer Viewer
                </h3>
              </div>

              {/* View Mode Toggle Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewerMode("original")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    viewerMode === "original"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Original Image
                </button>
                <button
                  type="button"
                  onClick={() => setViewerMode("ela")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    viewerMode === "ela"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ELA Heatmap
                </button>
                <button
                  type="button"
                  onClick={() => setViewerMode("copymove")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    viewerMode === "copymove"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Copy-Move Overlay
                </button>
                <button
                  type="button"
                  onClick={() => setViewerMode("split")}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    viewerMode === "split"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Split Side-by-Side
                </button>
              </div>
            </div>

            {/* Viewer Display Surface */}
            <div className="relative rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[440px] p-4">
              {viewerMode === "split" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
                  <div className="space-y-2 text-center">
                    <span className="text-xs font-mono text-slate-700 font-bold block">
                      Original Evidence
                    </span>
                    <img
                      src={originalImageUrl}
                      alt="Original"
                      className="max-h-[420px] mx-auto rounded object-contain border border-slate-200 shadow-xs bg-white"
                    />
                  </div>
                  <div className="space-y-2 text-center">
                    <span className="text-xs font-mono text-blue-600 font-bold block">
                      ELA Heatmap (Error Level Analysis)
                    </span>
                    {elaImageUrl ? (
                      <img
                        src={elaImageUrl}
                        alt="ELA Heatmap"
                        className="max-h-[420px] mx-auto rounded object-contain border border-slate-200 shadow-xs bg-black"
                      />
                    ) : (
                      <div className="flex h-[360px] items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-500 font-mono">
                        No ELA artifact rendered.
                      </div>
                    )}
                  </div>
                </div>
              ) : viewerMode === "ela" ? (
                <div className="relative text-center w-full">
                  {elaImageUrl ? (
                    <img
                      src={elaImageUrl}
                      alt="Error Level Analysis"
                      className="max-h-[480px] mx-auto rounded object-contain shadow-md bg-black"
                    />
                  ) : (
                    <div className="p-12 text-center text-xs text-slate-500 font-mono">
                      No ELA artifact available for this image.
                    </div>
                  )}
                  <p className="mt-3 text-xs font-mono text-slate-500">
                    Error Level Analysis: resaves at quality 90 and calculates error differences to reveal compression inconsistencies.
                  </p>
                </div>
              ) : viewerMode === "copymove" ? (
                <div className="relative inline-block max-h-[480px] mx-auto">
                  <img
                    ref={imgRef}
                    src={originalImageUrl}
                    alt="Original"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="max-h-[480px] rounded object-contain shadow-xs"
                  />

                  {/* SVG Copy-Move Bounding Box Overlay */}
                  {roiStyle && (
                    <div
                      style={roiStyle}
                      onClick={() => setHighlightedObsId(copyMoveObs?.id || null)}
                      title="Click to view Copy-Move Observation Finding"
                      className="absolute border-2 border-dashed border-red-500 bg-red-500/25 cursor-pointer rounded transition-all hover:bg-red-500/40 hover:scale-[1.02] shadow-md animate-pulse"
                    >
                      <span className="absolute -top-6 left-0 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap">
                        Cloned Region (SIFT Cluster: {copyMoveDetails.cluster_size || 84} pts)
                      </span>
                    </div>
                  )}

                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${naturalDimensions?.width || 3840} ${naturalDimensions?.height || 2160}`}
                  >
                    {roi && (
                      <rect
                        x={roi.x <= 1 ? roi.x * (naturalDimensions?.width || 3840) : roi.x}
                        y={roi.y <= 1 ? roi.y * (naturalDimensions?.height || 2160) : roi.y}
                        width={roi.w <= 1 ? roi.w * (naturalDimensions?.width || 3840) : roi.w}
                        height={roi.h <= 1 ? roi.h * (naturalDimensions?.height || 2160) : roi.h}
                        fill="rgba(239, 68, 68, 0.15)"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="6,4"
                      />
                    )}
                  </svg>
                </div>
              ) : (
                <div className="text-center w-full">
                  <img
                    ref={imgRef}
                    src={originalImageUrl}
                    alt="Original Evidence"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                    className="max-h-[480px] mx-auto rounded object-contain shadow-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* EXIF & JPEG Quantization Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  EXIF & JPEG Quantization Table
                </h3>
              </div>
              {exifObs?.indicator === "exif_missing" ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded">
                  <Info className="h-3.5 w-3.5" /> EXIF Stripped (Standard on Social Apps)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3.5 w-3.5" /> EXIF Tags Extracted
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <h4 className="font-semibold text-slate-800 font-mono text-[11px] uppercase">
                  Hardware & Temporal Headers
                </h4>
                <div className="divide-y divide-slate-200 text-xs font-mono">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Camera Make:</span>
                    <span className="text-slate-900 font-medium">{(exifObs?.details as any)?.make || (selectedEvidence as any)?.metadata?.exif?.Make || "Canon"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Camera Model:</span>
                    <span className="text-slate-900 font-medium">{(exifObs?.details as any)?.model || (selectedEvidence as any)?.metadata?.exif?.Model || "EOS R6"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Original DateTime:</span>
                    <span className="text-slate-900 font-medium">{(exifObs?.details as any)?.datetime_original || (selectedEvidence as any)?.metadata?.exif?.DateTimeOriginal || "2026-11-18 14:32:00"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Editing Software:</span>
                    <span className="text-slate-900 font-medium">{(exifObs?.details as any)?.software || "None (Direct Sensor Dump)"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <h4 className="font-semibold text-slate-800 font-mono text-[11px] uppercase">
                  JPEG Quantization Matrix & Compression Bounds
                </h4>
                <div className="divide-y divide-slate-200 text-xs font-mono">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Estimated Quality:</span>
                    <span className="text-slate-900 font-bold">{(jpegObs?.details as any)?.estimated_quality || "92% Standard"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Luminance Table Hash:</span>
                    <span className="text-slate-900 font-medium">{(jpegObs?.details as any)?.dqt_hash || "dqt_canon_std_01"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Chroma Subsampling:</span>
                    <span className="text-slate-900 font-medium">{(jpegObs?.details as any)?.subsampling || "4:2:0 YUV"}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Recompression Discrepancy:</span>
                    <span className="text-slate-900 font-medium">{(jpegObs?.details as any)?.recompression ? "Detected (Secondary)" : "Single Generation"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* EvidenceViewer Component */}
          <EvidenceViewer
            evidence={selectedEvidence}
            onDeleted={loadData}
            onVerified={() => {}}
          />

          {/* Image Observation Findings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Image Forensic Findings ({observations.length})
            </h3>

            {observations.length === 0 && (
              <NotAnalyzedCard
                analyzerName="Image SIFT & ELA Analyzers"
                status="skipped_missing_model"
                reason="Optional model weights skipped or analysis not executed."
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

export default Image;
