import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

const WORKFLOW_STAGES = [
  {
    step: "1",
    id: "ingest",
    title: "INGEST",
    badge: "Immutable Store",
    icon: UploadCloud,
    description: "Ingest multi-source media (images, video, audio, social captions) into local disk storage with strict mode 0444 read-only permissions and SHA-256 hash chains.",
  },
  {
    step: "2",
    id: "analyze",
    title: "ANALYZE",
    badge: "Pure Functions",
    icon: Microscope,
    description: "Run deterministic signal analyzers locally on CPU: ELA, SIFT copy-move, container ffprobe, PTS continuity, spectral flux, and int8 quantized Whisper speech transcription.",
  },
  {
    step: "3",
    id: "correlate",
    title: "CORRELATE",
    badge: "Cross-Modal Graph",
    icon: GitBranch,
    description: "Cross-examine multi-modal signals against stated claims without opening raw media. Construct graph edges for SUPPORTS, CONTRADICTS, and CO_OCCURS relationships.",
  },
  {
    step: "4",
    id: "review",
    title: "REVIEW",
    badge: "Human Agency",
    icon: CheckSquare,
    description: "Empower human analysts to review every moderate/strong finding, inspect alternative benign explanations, and record immutable append-only audit decisions.",
  },
  {
    step: "5",
    id: "report",
    title: "REPORT",
    badge: "Reproducible Audit",
    icon: FileSpreadsheet,
    description: "Export forensically honest, tamper-evident PDF and JSON verification dossiers generated strictly from database rows, complete with cryptographic verification hashes.",
  },
];

export const Landing: React.FC = () => {
  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14 bg-white">
      {/* Hero Section */}
      <section className="text-center space-y-4 max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-[#EFF6FF] px-3.5 py-1 text-xs font-semibold text-primary shadow-sm">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Decision-Support Workbench · Not a Verdict Machine</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-on-surface leading-tight">
          Deterministic Digital Media <br />
          <span className="text-primary">
            Forensic Verification Workbench
          </span>
        </h1>

        <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
          TruthLens X rejects invented "deepfake percentage" scores. Built for investigative newsrooms, legal teams, and fact-checkers, it provides transparent signal extraction, cross-modal contradictions, mandatory alternative explanations, and a cryptographic audit trail.
        </p>

        {/* Quick CTA Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link
            to="/cases/new"
            className="flex items-center gap-2 bg-primary-container hover:bg-primary text-white font-semibold px-5 py-2.5 rounded shadow-sm transition-all text-xs sm:text-sm group"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Investigation</span>
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-2 bg-white hover:bg-surface-container-low text-on-surface font-semibold px-5 py-2.5 rounded border border-outline-variant transition-all text-xs sm:text-sm shadow-sm"
          >
            <Folder className="h-4 w-4 text-on-surface-variant" />
            <span>Open Case Directory</span>
          </Link>
        </div>
      </section>

      {/* 5-Stage Workflow Overview */}
      <section className="space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-on-surface tracking-tight uppercase">
            The 5-Stage Verification Workflow
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xl mx-auto">
            From raw media ingestion to reproducible audit reporting — an end-to-end disciplined methodology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {WORKFLOW_STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="relative rounded border border-outline-variant bg-white p-4 flex flex-col justify-between space-y-3 hover:border-primary/50 hover:shadow-sm transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EFF6FF] text-primary border border-blue-200 font-mono text-xs font-bold">
                      {stage.step}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-on-surface-variant uppercase bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant">
                      {stage.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-on-surface tracking-wider uppercase flex items-center gap-1.5 mb-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary group-hover:text-blue-700" />
                    <span>{stage.title}</span>
                  </h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Forensic Tenets */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded border border-outline-variant bg-surface-container-low p-5 space-y-2 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Cpu className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-on-surface">100% Local-First & Offline</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Zero cloud uploads. Operates air-gapped on standard laptop CPUs without leaking sensitive whistleblower material or confidential source media.
          </p>
        </div>

        <div className="rounded border border-outline-variant bg-surface-container-low p-5 space-y-2 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[#EFF6FF] text-primary border border-blue-200">
            <Scale className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-on-surface">Forensic Honesty & Balance</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Every weak or moderate finding couples with explicit benign alternative explanations. Missing EXIF and ordinary video cuts are informational by default.
          </p>
        </div>

        <div className="rounded border border-outline-variant bg-surface-container-low p-5 space-y-2 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[#EFF6FF] text-primary border border-blue-200">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-on-surface">Immutable Store & Audit Chains</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Evidence originals are locked read-only (mode 0444). Ingestion, reviewer decisions, and hash checks are cryptographically logged in append-only SQLite WAL storage.
          </p>
        </div>
      </section>

      {/* Recent Verification Cases */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-on-surface">
              Recent Verification Cases
            </h2>
          </div>
          <Link
            to="/cases/new"
            className="text-xs font-semibold text-primary hover:text-blue-800 flex items-center gap-1"
          >
            <span>+ Create Case</span>
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded border border-outline-variant bg-surface-container-low p-10 text-center text-xs text-on-surface-variant font-mono">
            Loading verification cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded border border-dashed border-outline-variant bg-surface-container-low p-10 text-center space-y-3">
            <FileSearch className="h-8 w-8 text-on-surface-variant/50 mx-auto" />
            <h3 className="text-sm font-semibold text-on-surface">No Cases Ingested Yet</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Get started by initializing a verification case, uploading suspect media, and providing context claims.
            </p>
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-1.5 bg-primary-container hover:bg-primary text-white text-xs font-semibold px-4 py-2 rounded transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Case</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="group rounded border border-outline-variant bg-white p-5 hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase font-semibold">
                      {c.id}
                    </span>
                    <span className="inline-flex items-center rounded bg-[#D0E0FF] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#0B1C32]">
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                    {c.title}
                  </h4>
                  {c.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">
                      {c.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant">
                  <span>{c.evidence_count} evidence item(s)</span>
                  <span className="flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                    Open Workbench <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Landing;
