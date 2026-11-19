import React, { useState } from "react";
import { Info, X, ShieldAlert, Scale, HelpCircle, Layers } from "lucide-react";
import { StrengthBadge } from "./StrengthBadge";

interface EvidenceStrengthLegendProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isModal?: boolean;
}

export const EvidenceStrengthLegend: React.FC<EvidenceStrengthLegendProps> = ({
  className = "",
  isOpen = false,
  onClose,
  isModal = false,
}) => {
  const [activeTab, setActiveTab] = useState<"scale" | "whyNoScore" | "uncertainty">("scale");

  const content = (
    <div className="space-y-6 text-xs text-on-surface">
      {/* Tabs */}
      <div className="flex border-b border-outline-variant gap-1 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("scale")}
          className={`px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "scale"
              ? "bg-primary-container text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>4-Tier Strength Scale</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("whyNoScore")}
          className={`px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "whyNoScore"
              ? "bg-primary-container text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          <span>Why No "Fake Score"?</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("uncertainty")}
          className={`px-3 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === "uncertainty"
              ? "bg-primary-container text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>5 Uncertainty Categories</span>
        </button>
      </div>

      {/* Tab 1: Strength Scale */}
      {activeTab === "scale" && (
        <div className="space-y-4">
          <p className="text-on-surface-variant leading-relaxed">
            TruthLens X uses a deterministic 4-tier evidence scale. Each observation reflects the reproducible statistical strength of an anomaly and its likelihood of benign alternative causes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded border border-outline-variant bg-surface-container-low p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <StrengthBadge strength="informational" />
                <span className="font-mono text-[10px] text-on-surface-variant">Tier 0</span>
              </div>
              <h5 className="font-semibold text-on-surface text-xs">Informational</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                Technical metadata, standard structural boundaries, or benign omissions. Missing EXIF tags on messaging apps or ordinary video scene transitions are informational by default, never suspicious.
              </p>
            </div>

            <div className="rounded border border-[rgba(37,99,235,0.25)] bg-[#EFF6FF] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <StrengthBadge strength="weak" />
                <span className="font-mono text-[10px] text-primary">Tier 1</span>
              </div>
              <h5 className="font-semibold text-primary text-xs">Weak Evidence</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                Ambiguous statistical deviation with a high benign false-positive rate. E.g., minor high-frequency DCT quantization variances or single-packet audio drops.
              </p>
            </div>

            <div className="rounded border border-[rgba(217,119,6,0.25)] bg-[#FFF5E6] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <StrengthBadge strength="moderate" />
                <span className="font-mono text-[10px] text-[#D97706]">Tier 2</span>
              </div>
              <h5 className="font-semibold text-[#D97706] text-xs">Moderate Evidence</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                Coherent anomalous pattern warranting human scrutiny. E.g., spatial copy-move keypoint clusters, abrupt spectral flux jump at audio splice, or numerical claim mismatch.
              </p>
            </div>

            <div className="rounded border border-[rgba(220,38,38,0.25)] bg-[#FDEBEC] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <StrengthBadge strength="strong" />
                <span className="font-mono text-[10px] text-error">Tier 3</span>
              </div>
              <h5 className="font-semibold text-error text-xs">Strong Evidence</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                High-confidence physical or temporal impossibility demonstrated across orthogonal, independent modalities. E.g., solar azimuth shadowing contradicting verified GPS timestamp.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Why No Global Fake Score */}
      {activeTab === "whyNoScore" && (
        <div className="space-y-4">
          <div className="rounded border border-blue-200 bg-[#EFF6FF] p-4 space-y-2">
            <h4 className="font-bold text-primary text-xs flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert className="h-4 w-4 text-primary" />
              The Fallacy of "Global Fake Probability"
            </h4>
            <p className="text-on-surface leading-relaxed">
              Commercial verification tools frequently display single aggregate metrics such as <em>"94% Fake"</em>. TruthLens X categorically rejects this approach as pseudoscientific and harmful to forensic accountability.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <h5 className="font-semibold text-on-surface text-xs mb-1">1. The Base-Rate Fallacy</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                Computing a posterior probability P(Fake | Signals) requires knowing the prior base-rate distribution of forged media in the wild. Synthetically balanced lab benchmarks fail completely in real-world scenarios.
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <h5 className="font-semibold text-on-surface text-xs mb-1">2. Hiding Benign Alternative Causes</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                An aggregate percentage conflates routine video editing, social re-encoding, and legitimate colloquial speech with malicious manipulation, giving investigators an unearned sense of mathematical precision.
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <h5 className="font-semibold text-on-surface text-xs mb-1">3. Inadmissibility & Legal Vulnerability</h5>
              <p className="text-on-surface-variant leading-relaxed text-[11px]">
                Under legal standards (Daubert / Frye standards in the US, Rule 11 in court submissions), expert testimony requires verifiable error rates, testability, and explainable provenance. Black-box percentages fail every legal test.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 5 Uncertainty Categories */}
      {activeTab === "uncertainty" && (
        <div className="space-y-3">
          <p className="text-on-surface-variant leading-relaxed">
            Digital media forensics operates under intrinsic technical uncertainties. Every finding in TruthLens X maps to one or more of these 5 categories:
          </p>

          <div className="space-y-2">
            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <span className="font-mono text-primary font-bold text-[10px] uppercase">Category 1</span>
              <h5 className="font-semibold text-on-surface text-xs">Compression & Transcoding Uncertainty</h5>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Lossy re-encoding (JPEG quality drops, H.264 GOP macroblock quantization) creates localized noise variations that mimic manipulation.
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <span className="font-mono text-primary font-bold text-[10px] uppercase">Category 2</span>
              <h5 className="font-semibold text-on-surface text-xs">Sensor & Acquisition Hardware Uncertainty</h5>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Camera CMOS rolling shutter, optical lens distortion, sensor Bayer demosaicing, and microphone wind buffeting introduce physical recording anomalies.
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <span className="font-mono text-primary font-bold text-[10px] uppercase">Category 3</span>
              <h5 className="font-semibold text-on-surface text-xs">Algorithmic & Model Uncertainty</h5>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Neural networks trained on constrained datasets output uncalibrated scores on out-of-distribution real media, labeled explicitly as "uncalibrated model output".
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <span className="font-mono text-primary font-bold text-[10px] uppercase">Category 4</span>
              <h5 className="font-semibold text-on-surface text-xs">Semantic & Linguistic Uncertainty</h5>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Spoken language uses rounding, figurative hyperbole, or preliminary estimates (e.g. "several hundred") that naturally conflict with precise headcount claims.
              </p>
            </div>

            <div className="rounded border border-outline-variant bg-surface-container-low p-3">
              <span className="font-mono text-primary font-bold text-[10px] uppercase">Category 5</span>
              <h5 className="font-semibold text-on-surface text-xs">Environmental & Multi-Source Uncertainty</h5>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                Multi-camera angle switching, acoustic room reverb, stage lighting changes, and crowd movement create discontinuity across independent vantage points.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-outline-variant bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant mb-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-on-surface tracking-tight">
                Forensic Evidence-Strength Framework
              </h3>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  // Inline container
  return (
    <div className={`rounded-lg border border-outline-variant bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-bold text-on-surface uppercase tracking-wider text-xs">
            Forensic Evidence-Strength Framework
          </span>
        </div>
        <span className="text-[10px] font-mono text-on-surface-variant">Local-First · Rule-Based</span>
      </div>
      {content}
    </div>
  );
};
