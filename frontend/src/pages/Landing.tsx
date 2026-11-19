import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

const WORKFLOW_STAGES = [
  {
    step: "1",
    id: "ingest",
    title: "INGEST",
    badge: "Immutable Store",
    icon: UploadCloud,
    description: "Ingest media (images, video, audio, captions) into read-only storage (mode 0444) with SHA-256 hash chains.",
  },
  {
    step: "2",
    id: "analyze",
    title: "ANALYZE",
    badge: "Pure Functions",
    icon: Microscope,
    description: "Run deterministic signal analyzers locally: ELA, SIFT copy-move, container ffprobe, PTS continuity, spectral flux, and Whisper ASR.",
  },
  {
    step: "3",
    id: "correlate",
    title: "CORRELATE",
    badge: "Cross-Modal Graph",
    icon: GitBranch,
    description: "Cross-examine multi-modal signals against stated claims without opening raw media. Construct relation edges.",
  },
  {
    step: "4",
    id: "review",
    title: "REVIEW",
    badge: "Human Agency",
    icon: CheckSquare,
    description: "Empower human analysts to review findings, inspect alternative benign explanations, and record immutable audit decisions.",
  },
  {
    step: "5",
    id: "report",
    title: "REPORT",
    badge: "Reproducible Audit",
    icon: FileSpreadsheet,
    description: "Export forensically honest, tamper-evident PDF and JSON verification dossiers generated strictly from database rows.",
  },
];

export const Landing: React.FC = () => {
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

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-10">
      {/* 1. Compact Hero Section */}
      <section className="text-center space-y-3.5 max-w-3xl mx-auto pt-2 pb-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <span>Decision-Support Workbench · Not a Verdict Machine</span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          Deterministic Digital Media <br />
          <span className="text-blue-600">
            Forensic Verification Workbench
          </span>
        </h1>

        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
          TruthLens X rejects invented "deepfake percentage" scores. Built for investigative newsrooms, legal teams, and fact-checkers, it provides transparent signal extraction, cross-modal contradictions, mandatory alternative explanations, and a cryptographic audit trail.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/cases/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-colors text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Investigation</span>
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2.5 rounded-lg border border-slate-200 transition-colors text-xs sm:text-sm shadow-xs"
          >
            <Folder className="h-4 w-4 text-slate-500" />
            <span>Open Case Directory</span>
          </Link>
        </div>
      </section>

      {/* 2. Five-Stage Verification Workflow */}
      <section className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-bold text-slate-500 tracking-wider uppercase font-mono">
            The 5-Stage Verification Workflow
          </h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            From raw media ingestion to reproducible audit reporting — a disciplined, deterministic methodology.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {WORKFLOW_STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between space-y-2.5 hover:border-blue-400/80 hover:shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px] font-bold">
                      {stage.step}
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {stage.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase flex items-center gap-1.5 mb-1">
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

      {/* 3. Three Platform Principles */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-5 space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Cpu className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">100% Local-First & Offline</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zero cloud uploads. Operates air-gapped on standard laptop CPUs without leaking sensitive whistleblower material or confidential source media.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-5 space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <Scale className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Forensic Honesty & Balance</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every weak or moderate finding couples with explicit benign alternative explanations. Missing EXIF and ordinary video cuts are informational by default.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 sm:p-5 space-y-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Immutable Store & Audit Chains</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Evidence originals are locked read-only (mode 0444). Ingestion, reviewer decisions, and hash checks are cryptographically logged in append-only SQLite WAL storage.
          </p>
        </div>
      </section>

      {/* 4. Recent Verification Cases (High Visual Density, 2-Column Desktop) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono">
              Recent Verification Cases
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              ({cases.length} Total)
            </span>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>View All in Directory</span>
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
                  className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5 h-[132px]"
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
                      Open Workbench <ArrowRight className="h-3 w-3" />
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
    </div>
  );
};

export default Landing;
