import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  Folder,
  Cpu,
  Lock,
  Scale,
  ArrowRight,
  FileSearch,
  UploadCloud,
  Microscope,
  GitBranch,
  CheckSquare,
  FileSpreadsheet,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Binary,
  Activity,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Terminal,
  FileCheck,
  Eye,
  Hash,
  Download,
} from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

const WORKFLOW_STAGES = [
  {
    step: "01",
    id: "ingest",
    title: "Secure Ingestion",
    badge: "Mode 0444 Store",
    icon: UploadCloud,
    description:
      "Original media (images, video, audio, text) is stored in an immutable, read-only filesystem with SHA-256 cryptographic hash chains.",
  },
  {
    step: "02",
    id: "analyze",
    title: "Deterministic Analysis",
    badge: "Local CPU Pure Fn",
    icon: Microscope,
    description:
      "Signal extractors execute locally: Error Level Analysis (ELA), SIFT copy-move, container ffprobe, PTS continuity, spectral flux, and Whisper ASR.",
  },
  {
    step: "03",
    id: "correlate",
    title: "Cross-Modal Correlation",
    badge: "Contradiction Rules",
    icon: GitBranch,
    description:
      "Automated rule engine (R1–R8) compares visual cuts, audio noise shifts, and extracted speech against stated claims without opening raw media.",
  },
  {
    step: "04",
    id: "review",
    title: "Human Agency Review",
    badge: "Analyst Decision",
    icon: CheckSquare,
    description:
      "Forensic analysts evaluate anomaly observations against mandatory benign alternative hypotheses to prevent false accusations.",
  },
  {
    step: "05",
    id: "report",
    title: "Evidentiary Dossier",
    badge: "Tamper-Evident Export",
    icon: FileSpreadsheet,
    description:
      "Exports an 11-section courtroom-ready verification dossier in PDF and JSON formats with full cryptographic audit trail and coverage matrix.",
  },
];

const MODALITY_CARDS = [
  {
    id: "image",
    title: "Image Forensics",
    subtitle: "Compression Discrepancies & Cloned Regions",
    icon: ImageIcon,
    badge: "JPEG / PNG / WEBP",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    features: [
      "Error Level Analysis (ELA) for re-saving resynthesis",
      "SIFT Keypoint Matching for copy-move clone detection",
      "EXIF header integrity and camera fingerprint extraction",
      "DCT quantization table consistency checks",
    ],
    pathSuffix: "/image",
  },
  {
    id: "video",
    title: "Video Forensics",
    subtitle: "Temporal Stream & Container Telemetry",
    icon: Film,
    badge: "MP4 / MKV / AVI / MOV",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    features: [
      "Presentation Timestamp (PTS/DTS) continuity inspection",
      "HSV color histogram scene boundary cut detection",
      "FFprobe codec parameters, bitrates, and GOP structures",
      "Audio-video stream container synchronization",
    ],
    pathSuffix: "/video",
  },
  {
    id: "audio",
    title: "Audio Forensics",
    subtitle: "Acoustic Discontinuities & Speech Recognition",
    icon: Music,
    badge: "WAV / MP3 / M4A",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    features: [
      "STFT Mel-spectrogram & waveform envelope generation",
      "Spectral flux anomaly detection at splice boundaries",
      "Ambient noise-floor jump and cut flagging",
      "Offline Whisper ASR speech transcription and rate metrics",
    ],
    pathSuffix: "/audio",
  },
  {
    id: "text",
    title: "Text Cross-Examination",
    subtitle: "Entity, Timeline & Claim Triangulation",
    icon: FileText,
    badge: "NLP & Claim Logic",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    features: [
      "Claim and headline entity extraction",
      "Cross-modal timestamp contradiction vs EXIF capture times",
      "Numerical assertion validation vs visual/OCR facts",
      "Spoken transcript alignment with social media captions",
    ],
    pathSuffix: "/text",
  },
];

const CORRELATION_RULES = [
  {
    code: "R1",
    name: "A/V Cut Asynchrony",
    desc: "Video scene transition detected without corresponding audio cut, or audio noise shift without video frame change.",
    impact: "Flagged Splice",
  },
  {
    code: "R2",
    name: "Claim vs EXIF Contradiction",
    desc: "Claimed broadcast/event timestamp disagrees with verified hardware camera EXIF or container creation time.",
    impact: "Temporal Anomaly",
  },
  {
    code: "R3",
    name: "Claim vs Numeric Reality",
    desc: "Numerical claim stated in caption contradicts quantified evidence data points or OCR counts.",
    impact: "Factual Contradiction",
  },
  {
    code: "R4",
    name: "Transcript vs Acoustic Shift",
    desc: "Acoustic boundary splice occurs within a spoken sentence identified in the speech transcript.",
    impact: "Audio Edit Detected",
  },
  {
    code: "R5",
    name: "Metadata Loss + ELA Anomaly",
    desc: "Complete stripping of EXIF metadata coincides with localized high-contrast compression differences.",
    impact: "Tampering Indicator",
  },
  {
    code: "R6",
    name: "Background Noise Instability",
    desc: "Abrupt jump in ambient room tone or spectral frequency distribution across contiguous frames.",
    impact: "Acoustic Splicing",
  },
];

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(6);

  useEffect(() => {
    api
      .getCases()
      .then((res) => {
        setCases(res.cases || []);
      })
      .catch((err: any) => {
        setErrorMsg(err.message || "Failed to load recent cases.");
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleCases = useMemo(() => {
    return cases.slice(0, displayLimit);
  }, [cases, displayLimit]);

  // Target case for direct workbench entry
  const targetCaseId = cases.length > 0 ? cases[0].id : null;

  const handleStartInvestigation = () => {
    if (targetCaseId) {
      navigate(`/cases/${targetCaseId}`);
    } else {
      navigate("/cases/new");
    }
  };

  return (
    <div className="flex flex-col gap-12 w-full">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1829] via-[#14243b] to-[#1c3352] text-white p-8 sm:p-12 lg:p-16 border border-slate-800 shadow-xl">
        {/* Subtle decorative grid background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 backdrop-blur-xs px-4 py-1.5 text-xs font-semibold text-blue-300 shadow-inner">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            <span>Multimodal Digital Forensics & Verification Architecture</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Uncover the Truth <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Behind Digital Media
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-3xl mx-auto font-normal">
            A deterministic digital forensics workbench that cross-examines visual, acoustic, and
            textual evidence to expose deepfakes, splicing, and synthetic manipulation. Rejects
            opaque probability scores in favor of verifiable signal anomalies, mandatory benign
            hypotheses, and cryptographic audit trails.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
            <button
              onClick={handleStartInvestigation}
              className="inline-flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-blue-900/30 transition-all text-sm group"
            >
              <span>Start Investigation</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 font-semibold px-5 py-3.5 rounded-xl border border-slate-700 shadow-md transition-all text-sm"
            >
              <Plus className="h-4 w-4 text-blue-400" />
              <span>Create New Case</span>
            </Link>

            <Link
              to="/history"
              className="inline-flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-medium px-4 py-3.5 rounded-xl border border-slate-700/50 transition-all text-sm"
            >
              <Folder className="h-4 w-4 text-slate-400" />
              <span>Case Directory ({cases.length})</span>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 border-t border-slate-700/60 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                100% Offline
              </div>
              <div className="text-[11px] text-slate-400">Zero cloud API transmissions</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-blue-400">Mode 0444 Store</div>
              <div className="text-[11px] text-slate-400">Immutable read-only evidence</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-sky-400">SHA-256 Ledger</div>
              <div className="text-[11px] text-slate-400">Tamper-evident audit chain</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-indigo-400">Rules R1–R8</div>
              <div className="text-[11px] text-slate-400">Cross-modal correlation engine</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MULTIMODAL FORENSIC ANALYSIS MODULES */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-bold font-mono text-blue-600 uppercase tracking-wider mb-1">
              Comprehensive Forensic Coverage
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Multimodal Analysis Pipelines
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Signal extraction runs locally on your machine with deterministic algorithms across all primary digital media formats.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODALITY_CARDS.map((card) => {
            const Icon = card.icon;
            const destUrl = targetCaseId
              ? `/cases/${targetCaseId}${card.pathSuffix}`
              : "/cases/new";

            return (
              <div
                key={card.id}
                className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-800 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${card.badgeColor}`}
                    >
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{card.subtitle}</p>
                  </div>

                  <ul className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    {card.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <Link
                    to={destUrl}
                    className="inline-flex items-center justify-between w-full text-xs font-semibold text-blue-600 hover:text-blue-800 group-hover:translate-x-0.5 transition-all"
                  >
                    <span>Launch Analyzer</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section className="space-y-6 rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold font-mono text-blue-600 uppercase tracking-wider">
            Disciplined Forensic Methodology
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            How TruthLens X Works
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            From raw media ingestion to reproducible verification dossiers, every step guarantees
            transparency, auditability, and verifiable proof.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {WORKFLOW_STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-3 hover:border-blue-400 hover:shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white font-mono text-xs font-bold">
                      {stage.step}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {stage.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Icon className="h-3.5 w-3.5 text-blue-600" />
                    <span>{stage.title}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. CROSS-MODAL INTELLIGENCE SECTION */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-bold font-mono text-indigo-600 uppercase tracking-wider mb-1">
              Multi-Source Synthesis
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Cross-Modal Correlation Engine
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-md">
            Single-modality tools are fooled by clever filters. TruthLens X isolates deepfakes by
            triangulating discrepancies across independent modalities without inspecting raw content twice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CORRELATION_RULES.map((rule) => (
            <div
              key={rule.code}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  Rule {rule.code}
                </span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  {rule.impact}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{rule.name}</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">{rule.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. EVIDENCE-BASED REPORTING SECTION */}
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-[#14243b] to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <FileCheck className="h-4 w-4 text-blue-400" />
              <span>Courtroom & Newsroom Evidentiary Standard</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Evidence-Based Reporting & Cryptographic Dossiers
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every investigation generates an 11-section formal verification dossier. No opaque
              summaries: findings list algorithmic metrics, sensor telemetry, and mandatory benign
              alternative explanations. Exportable as PDF or JSON for courtroom submission,
              academic review, and journalistic publication.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>11-Section Verification Report</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Modality Coverage Matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>SHA-256 Checksum Provenance</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Forensic Reviewer Audit Log</span>
              </div>
            </div>

            <div className="pt-3">
              <Link
                to={targetCaseId ? `/cases/${targetCaseId}/report` : "/history"}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Inspect Forensic Report Dossier</span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-5 space-y-3 font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-blue-400 font-bold">DOSSIER SPECIFICATION</span>
              <span className="text-[10px] text-slate-500">v1.4.2 COMPLIANT</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Evidence Store:</span>
                <span className="text-slate-200">Mode 0444 Immutable</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ledger Algorithm:</span>
                <span className="text-slate-200">SHA-256 Hash Chaining</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Classification:</span>
                <span className="text-amber-400">Hypothesis Matrix (4-Tier)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audit Storage:</span>
                <span className="text-slate-200">SQLite WAL Append-Only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Export Formats:</span>
                <span className="text-emerald-400">PDF Dossier / JSON Manifest</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. RECENT INVESTIGATIONS DIRECTORY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Active Investigations Directory
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              ({cases.length} Total)
            </span>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>View All Cases</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 text-center text-xs text-slate-500 font-mono">
            Loading verification cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
            <FileSearch className="h-8 w-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No Cases Ingested Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Get started by initializing a verification case, uploading suspect media, and providing context claims.
            </p>
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Case</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {visibleCases.map((c) => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5 h-[132px]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] text-blue-600 font-semibold truncate max-w-[140px]">
                        {c.id}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : c.status === "running" || c.status === "analyzing"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                      {c.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.description || "No investigative context provided."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-slate-400" />
                      <span>{c.evidence_count} evidence item{c.evidence_count !== 1 ? "s" : ""}</span>
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-blue-600 font-sans text-xs group-hover:translate-x-0.5 transition-transform">
                      Open Investigation <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination / View More Controls */}
            {cases.length > 6 && (
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-slate-500 font-mono">
                  Showing {visibleCases.length} of {cases.length} cases
                </span>
                <div className="flex items-center gap-2">
                  {displayLimit < cases.length ? (
                    <button
                      type="button"
                      onClick={() => setDisplayLimit((prev) => Math.min(prev + 6, cases.length))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Show More Cases</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisplayLimit(6)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Collapse to 6 Cases</span>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <Link
                    to="/history"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition-colors"
                  >
                    Open Directory
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 7. MODERN FOOTER */}
      <footer className="mt-8 border-t border-slate-200 pt-8 pb-12 text-slate-500 text-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <span>TruthLens X — Multimodal Forensics</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
              A transparent, local-first forensic verification workbench built for newsrooms,
              legal investigators, and intelligence analysts. Rejecting fabricated verdict scores in favor of
              mathematically sound signal extraction.
            </p>
            <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Local-First · CPU-Optimized</span>
              <span>•</span>
              <span>MIT License</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] font-mono">
              Investigation Modules
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/image` : "/cases/new"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Image Forensics (ELA & SIFT)
                </Link>
              </li>
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/video` : "/cases/new"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Video Forensics (PTS & Cuts)
                </Link>
              </li>
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/audio` : "/cases/new"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Audio Forensics (Flux & ASR)
                </Link>
              </li>
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/text` : "/cases/new"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Text Cross-Examination
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] font-mono">
              Workbench Resources
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <Link to="/cases/new" className="hover:text-blue-600 transition-colors">
                  Create New Investigation
                </Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-blue-600 transition-colors">
                  Case Repository
                </Link>
              </li>
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/graph` : "/history"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Correlation Graph
                </Link>
              </li>
              <li>
                <Link
                  to={targetCaseId ? `/cases/${targetCaseId}/report` : "/history"}
                  className="hover:text-blue-600 transition-colors"
                >
                  Forensic Dossier Generator
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>
            © 2026 TruthLens X. All evidence processed locally under SHA-256 integrity locks.
          </span>
          <span className="font-mono text-[10px]">
            Mode 0444 Store · SQLite WAL · Local CPU
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
