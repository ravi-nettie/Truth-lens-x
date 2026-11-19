import React, { useState, useEffect } from "react";
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Camera,
  Play,
  CheckCircle2,
  Filter,
  FileCheck2,
  RefreshCw,
  Hash,
  AlertTriangle,
  RotateCw,
  Loader2,
  Lock,
  Layers,
  Sparkles,
} from "lucide-react";
import { api, SchemaTimelineEvent, SchemaEvidenceResponse } from "../api/client";

interface TimelineViewProps {
  caseId: string;
  events: SchemaTimelineEvent[];
  evidenceItems: SchemaEvidenceResponse[];
  onRefresh?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  caseId,
  events,
  evidenceItems,
  onRefresh,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [verifyingHashId, setVerifyingHashId] = useState<string | null>(null);
  const [hashResults, setHashResults] = useState<
    Record<string, { match: boolean; expected: string; actual: string }>
  >({});
  const [auditStatus, setAuditStatus] = useState<{
    valid: boolean;
    count: number;
    errors: string[];
  } | null>(null);
  const [verifyAllFeedback, setVerifyAllFeedback] = useState<string | null>(null);

  const fetchAuditVerification = async () => {
    try {
      const res = await api.getAudit(caseId);
      setAuditStatus(res.verification);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchAuditVerification();
    }
  }, [caseId]);

  // Per-item hash verify
  const handleVerifyHash = async (evidenceId: string) => {
    setVerifyingHashId(evidenceId);
    try {
      const res = await api.verifyEvidenceHash(evidenceId);
      setHashResults((prev) => ({
        ...prev,
        [evidenceId]: {
          match: res.match,
          expected: res.expected_sha256,
          actual: res.actual_sha256,
        },
      }));
      await fetchAuditVerification();
      if (onRefresh) onRefresh();
    } catch {
      setHashResults((prev) => ({
        ...prev,
        [evidenceId]: { match: false, expected: "unknown", actual: "verification_error" },
      }));
    } finally {
      setVerifyingHashId(null);
    }
  };

  // USP 2: Re-Verify All Evidence Hashes button
  const handleReverifyAllHashes = async () => {
    if (evidenceItems.length === 0) return;
    setIsVerifyingAll(true);
    setVerifyAllFeedback(null);

    let matchCount = 0;
    try {
      for (const ev of evidenceItems) {
        try {
          const res = await api.verifyEvidenceHash(ev.id);
          if (res.match) matchCount++;
          setHashResults((prev) => ({
            ...prev,
            [ev.id]: {
              match: res.match,
              expected: res.expected_sha256,
              actual: res.actual_sha256,
            },
          }));
        } catch {
          setHashResults((prev) => ({
            ...prev,
            [ev.id]: { match: false, expected: ev.sha256, actual: "verification_error" },
          }));
        }
      }

      await fetchAuditVerification();
      if (onRefresh) onRefresh();
      setVerifyAllFeedback(
        `All ${evidenceItems.length} evidence hashes verified: ${matchCount}/${evidenceItems.length} matching read-only originals.`
      );
    } finally {
      setIsVerifyingAll(false);
    }
  };

  // Filter chips matching prompt event kinds: upload, metadata, analysis_run, observation, review, hash_verify
  const filterChips = [
    { id: "all", label: "All Events" },
    { id: "upload", label: "upload" },
    { id: "metadata", label: "metadata" },
    { id: "analysis_run", label: "analysis_run" },
    { id: "observation", label: "observation" },
    { id: "review", label: "review" },
    { id: "hash_verify", label: "hash_verify" },
  ];

  // Normalize event kind matching
  const matchesFilter = (evtKind: string, filter: string) => {
    if (filter === "all") return true;
    const k = evtKind.toLowerCase();
    if (filter === "upload") return k === "upload";
    if (filter === "metadata") return k === "metadata" || k === "exif_timestamp";
    if (filter === "analysis_run") return k === "analysis_run";
    if (filter === "observation") return k === "observation" || k === "media_observation";
    if (filter === "review") return k === "review" || k === "review_decision";
    if (filter === "hash_verify") return k === "hash_verify" || k === "verify_hash";
    return k === filter;
  };

  const filteredEvents = events.filter((evt) => matchesFilter(evt.kind, activeFilter));

  const getEventBadge = (kind: string) => {
    const k = kind.toLowerCase();
    if (k === "upload") {
      return {
        icon: <Upload className="h-3.5 w-3.5 text-cyan-400" />,
        color: "border-cyan-800/80 bg-cyan-950/60 text-cyan-300",
        label: "Evidence Upload",
      };
    }
    if (k === "metadata" || k === "exif_timestamp") {
      return {
        icon: <Camera className="h-3.5 w-3.5 text-amber-400" />,
        color: "border-amber-800/80 bg-amber-950/60 text-amber-300",
        label: "Capture Metadata",
      };
    }
    if (k === "analysis_run") {
      return {
        icon: <Play className="h-3.5 w-3.5 text-indigo-400" />,
        color: "border-indigo-800/80 bg-indigo-950/60 text-indigo-300",
        label: "Analyzer Run",
      };
    }
    if (k === "observation" || k === "media_observation") {
      return {
        icon: <Clock className="h-3.5 w-3.5 text-purple-400" />,
        color: "border-purple-800/80 bg-purple-950/60 text-purple-300",
        label: "Media Observation",
      };
    }
    if (k === "review" || k === "review_decision") {
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
        color: "border-emerald-800/80 bg-emerald-950/60 text-emerald-300",
        label: "Analyst Review",
      };
    }
    if (k === "hash_verify" || k === "verify_hash") {
      return {
        icon: <Hash className="h-3.5 w-3.5 text-sky-400" />,
        color: "border-sky-800/80 bg-sky-950/60 text-sky-300",
        label: "Hash Verification",
      };
    }
    return {
      icon: <Clock className="h-3.5 w-3.5 text-slate-400" />,
      color: "border-slate-800 bg-slate-900 text-slate-300",
      label: kind,
    };
  };

  return (
    <div className="space-y-6">
      {/* Explicit Mandatory Header Note */}
      <div className="rounded-xl border border-indigo-900/60 bg-indigo-950/30 p-4 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>Forensic Provenance Notice</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">Local-First · Rule 2 & 3</span>
        </div>
        <p className="text-slate-200 text-sm font-semibold tracking-tight">
          "Provenance-aware audit trail — not legal chain of custody."
        </p>
        <p className="text-slate-400 text-xs leading-relaxed">
          This chronological timeline records technical provenance events across file ingestion, EXIF hardware headers, container timestamps, automated analysis runs, and append-only reviewer determinations. It does not replace sworn legal custodial attestations.
        </p>
      </div>

      {/* Evidence Cryptographic Integrity & Re-Verify All Button */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Cryptographic Evidence Integrity (SHA-256)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                Mode 0444 Immutable Evidence Store
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Audit Chain Badge */}
            {auditStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                  auditStatus.valid
                    ? "border-emerald-600/70 bg-emerald-950/70 text-emerald-300"
                    : "border-rose-600/70 bg-rose-950/70 text-rose-300"
                }`}
              >
                {auditStatus.valid ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Audit Trail Verified ({auditStatus.count} chained records)
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    Audit Chain Inconsistency
                  </>
                )}
              </span>
            )}

            {/* One-Click "Re-Verify All Evidence Hashes" Button */}
            <button
              type="button"
              onClick={handleReverifyAllHashes}
              disabled={isVerifyingAll || evidenceItems.length === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow transition-colors disabled:opacity-50"
            >
              {isVerifyingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
              ) : (
                <RotateCw className="h-3.5 w-3.5 text-white" />
              )}
              <span>Re-Verify All Evidence Hashes</span>
            </button>
          </div>
        </div>

        {verifyAllFeedback && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{verifyAllFeedback}</span>
          </div>
        )}

        {/* Evidence Grid with individual hash statuses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {evidenceItems.map((ev) => {
            const res = hashResults[ev.id];
            const isVerifying = verifyingHashId === ev.id;
            return (
              <div
                key={ev.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate max-w-[240px]">
                      {ev.filename}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {ev.modality}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-400 break-all">
                    <Hash className="h-3 w-3 shrink-0 text-indigo-400" />
                    <span>{ev.sha256}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  {res ? (
                    res.match ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" /> PASS: SHA-256 Match
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> FAIL: Hash Mismatch
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> mode 0444 read-only
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleVerifyHash(ev.id)}
                    disabled={isVerifying || isVerifyingAll}
                    className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1 rounded border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isVerifying ? "animate-spin text-indigo-400" : ""}`} />
                    <span>{isVerifying ? "Verifying..." : "Verify"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Chips by Event Kind */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
          <Filter className="h-3.5 w-3.5" /> Filter Events:
        </span>
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setActiveFilter(chip.id)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all ${
              activeFilter === chip.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Chronological Vertical Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-xs text-slate-500">
          No events match the selected "{activeFilter}" filter.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6 my-4">
          {filteredEvents.map((evt, idx) => {
            const badge = getEventBadge(evt.kind);
            return (
              <div key={evt.id || idx} className="relative group">
                {/* Timeline node pip */}
                <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-indigo-500 bg-slate-950 group-hover:scale-125 transition-transform ring-4 ring-slate-950" />

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2 hover:border-slate-700 hover:bg-slate-900 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <span className="font-mono text-slate-400 text-xs">
                      {evt.ts
                        ? new Date(evt.ts).toLocaleString()
                        : evt.media_time_ms !== null && evt.media_time_ms !== undefined
                        ? `Media Offset: ${evt.media_time_ms} ms`
                        : "Genesis"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-100 font-medium leading-relaxed">
                    {evt.label}
                  </p>

                  <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                    <span>Reference: {evt.ref_id}</span>
                    {evt.media_time_ms !== null && evt.media_time_ms !== undefined && (
                      <span className="text-purple-400 font-semibold">
                        Media Time: {evt.media_time_ms} ms
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelineView;
