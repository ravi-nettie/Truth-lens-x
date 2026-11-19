import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  PlusCircle,
  FolderGit2,
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
  HelpCircle,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-5 max-w-3xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Decision-Support Workbench · Not a Verdict Machine</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
          Deterministic Digital Media <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">
            Forensic Verification
          </span>
        </h1>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          TruthLens X rejects invented "deepfake percentage" scores. Built for investigative newsrooms, legal teams, and fact-checkers, it provides transparent signal extraction, cross-modal contradictions, mandatory alternative explanations, and a cryptographic audit trail.
        </p>

        {/* Quick CTA Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            to="/cases/new"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm group"
          >
            <PlusCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Create New Case</span>
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold px-6 py-3 rounded-xl border border-slate-800 transition-all text-sm"
          >
            <FolderGit2 className="h-4 w-4 text-slate-400" />
            <span>Open Case History</span>
          </Link>
        </div>
      </section>

      {/* 5-Stage Workflow Overview */}
      <section className="space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-black text-white tracking-tight uppercase">
            The 5-Stage Verification Workflow
          </h2>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            From raw media ingestion to reproducible audit reporting — an end-to-end disciplined methodology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {WORKFLOW_STAGES.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between space-y-3 hover:border-indigo-600/50 hover:bg-slate-900 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono text-xs font-bold">
                      {stage.step}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {stage.badge}
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-white tracking-wider uppercase flex items-center gap-1.5 mb-1.5">
                    <Icon className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-300" />
                    <span>{stage.title}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Forensic Tenets */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white">100% Local-First & Offline</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Zero cloud uploads. Operates air-gapped on standard laptop CPUs without leaking sensitive whistleblower material or confidential source media.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Forensic Honesty & Balance</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every weak or moderate finding couples with explicit benign alternative explanations. Missing EXIF and ordinary video cuts are informational by default.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Immutable Store & Audit Chains</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Evidence originals are locked read-only (mode 0444). Ingestion, reviewer decisions, and hash checks are cryptographically logged in append-only SQLite WAL storage.
          </p>
        </div>
      </section>

      {/* Recent Verification Cases */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Recent Verification Cases
            </h2>
          </div>
          <Link
            to="/cases/new"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>+ Create Case</span>
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 font-mono">
            Loading verification cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center space-y-3">
            <FileSearch className="h-8 w-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No Cases Ingested Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Get started by initializing a verification case, uploading suspect media, and providing context claims.
            </p>
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Case</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="group rounded-xl border border-slate-800 bg-slate-900/70 p-5 hover:border-indigo-600/50 hover:bg-slate-900 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-slate-400 uppercase">
                      {c.id}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-400 border border-slate-700">
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {c.title}
                  </h4>
                  {c.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {c.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-800/80">
                  <span>{c.evidence_count} evidence item(s)</span>
                  <span className="flex items-center gap-1 font-semibold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
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
