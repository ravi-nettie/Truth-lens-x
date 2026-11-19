import React, { useState, useEffect } from "react";
import {
  Clock,
  ShieldCheck,
  Upload,
  Camera,
  Play,
  CheckCircle2,
  FileCheck2,
  Hash,
  RotateCw,
  Loader2,
  Lock,
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
        icon: <Upload className="h-3.5 w-3.5 text-blue-600" />,
        color: "border-blue-200 bg-[#EFF6FF] text-primary",
        label: "Evidence Upload",
      };
    }
    if (k === "metadata" || k === "exif_timestamp") {
      return {
        icon: <Camera className="h-3.5 w-3.5 text-[#D97706]" />,
        color: "border-amber-200 bg-[#FFF5E6] text-[#D97706]",
        label: "Capture Metadata",
      };
    }
    if (k === "analysis_run") {
      return {
        icon: <Play className="h-3.5 w-3.5 text-indigo-600" />,
        color: "border-indigo-200 bg-indigo-50 text-indigo-700",
        label: "Analyzer Run",
      };
    }
    if (k === "observation" || k === "media_observation") {
      return {
        icon: <Clock className="h-3.5 w-3.5 text-purple-600" />,
        color: "border-purple-200 bg-purple-50 text-purple-700",
        label: "Media Observation",
      };
    }
    if (k === "review" || k === "review_decision") {
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
        color: "border-emerald-200 bg-emerald-50 text-emerald-700",
        label: "Analyst Review",
      };
    }
    if (k === "hash_verify" || k === "verify_hash") {
      return {
        icon: <Hash className="h-3.5 w-3.5 text-blue-600" />,
        color: "border-blue-200 bg-[#EFF6FF] text-primary",
        label: "Hash Verification",
      };
    }
    return {
      icon: <Clock className="h-3.5 w-3.5 text-on-surface-variant" />,
      color: "border-outline-variant bg-surface-container-low text-on-surface",
      label: kind,
    };
  };

  return (
    <div className="space-y-6">
      {/* Explicit Mandatory Header Note */}
      <div className="rounded border border-blue-200 bg-[#EFF6FF] p-4 space-y-1.5 text-xs shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-[11px]">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Forensic Provenance Notice</span>
          </div>
          <span className="font-mono text-[10px] text-on-surface-variant">Local-First · Rule 2 & 3</span>
        </div>
        <p className="text-on-surface text-sm font-bold tracking-tight">
          "Provenance-aware audit trail — not legal chain of custody."
        </p>
        <p className="text-on-surface-variant text-xs leading-relaxed">
          This chronological timeline records technical provenance events across file ingestion, EXIF hardware headers, container timestamps, automated analysis runs, and append-only reviewer determinations. It does not replace sworn legal custodial attestations.
        </p>
      </div>

      {/* Evidence Cryptographic Integrity & Re-Verify All Button */}
      <div className="rounded border border-outline-variant bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary-container text-white flex items-center justify-center shadow-sm">
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Cryptographic Evidence Integrity (SHA-256)
              </h3>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Mode 0444 Immutable Evidence Store
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Audit Chain Badge */}
            {auditStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${
                  auditStatus.valid
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {auditStatus.valid ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Audit Chain Valid ({auditStatus.count} entries)</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-rose-600" />
                    <span>Audit Chain Alert ({auditStatus.errors.length} errors)</span>
                  </>
                )}
              </span>
            )}

            {/* Re-verify All Hashes Button */}
            <button
              type="button"
              onClick={handleReverifyAllHashes}
              disabled={isVerifyingAll || evidenceItems.length === 0}
              className="flex items-center gap-1.5 bg-primary hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-all shadow-sm disabled:opacity-50"
            >
              {isVerifyingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              <span>Re-Verify All Evidence Hashes</span>
            </button>
          </div>
        </div>

        {verifyAllFeedback && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{verifyAllFeedback}</span>
          </div>
        )}

        {/* Evidence Hash Quick Table */}
        <div className="overflow-x-auto rounded border border-outline-variant">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant font-mono text-[10px] uppercase">
                <th className="py-2 px-3 font-semibold">Evidence File</th>
                <th className="py-2 px-3 font-semibold">Modality</th>
                <th className="py-2 px-3 font-semibold">SHA-256 Digest</th>
                <th className="py-2 px-3 font-semibold text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 font-mono text-xs">
              {evidenceItems.map((ev) => {
                const res = hashResults[ev.id];
                return (
                  <tr key={ev.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-2 px-3 font-sans font-semibold text-on-surface">
                      {ev.filename}
                    </td>
                    <td className="py-2 px-3 text-on-surface-variant uppercase text-[10px]">
                      {ev.modality}
                    </td>
                    <td className="py-2 px-3 text-primary text-[11px] truncate max-w-xs" title={ev.sha256}>
                      {ev.sha256}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {res ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                            res.match ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {res.match ? "MATCH VERIFIED" : "HASH MISMATCH"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleVerifyHash(ev.id)}
                          disabled={verifyingHashId === ev.id}
                          className="text-primary hover:text-blue-800 font-semibold text-[11px]"
                        >
                          {verifyingHashId === ev.id ? "Verifying..." : "Verify Hash"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Chips Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded border border-outline-variant shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mr-1">
            Filter:
          </span>
          {filterChips.map((chip) => {
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-primary-container text-white shadow-sm"
                    : "bg-surface-container-low text-on-surface border border-outline-variant hover:bg-surface-container"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs font-mono text-on-surface-variant">
          Showing {filteredEvents.length} of {events.length} events
        </span>
      </div>

      {/* Vertical Provenance Timeline */}
      <div className="relative pl-6 sm:pl-8 border-l-2 border-outline-variant space-y-6">
        {filteredEvents.map((evt) => {
          const badge = getEventBadge(evt.kind);

          return (
            <div key={evt.id} className="relative group">
              {/* Timeline Node Dot */}
              <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 border-primary shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
              </div>

              {/* Event Card */}
              <div className="rounded border border-outline-variant bg-white p-4 shadow-sm hover:border-primary/50 transition-all space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider ${badge.color}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-on-surface">
                      {evt.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-on-surface-variant">
                    {evt.ts && <span>{new Date(evt.ts).toLocaleString()}</span>}
                    {evt.media_time_ms !== null && evt.media_time_ms !== undefined && (
                      <span className="bg-surface-container-low border border-outline-variant px-1.5 py-0.5 rounded font-semibold text-primary">
                        Media Time: {evt.media_time_ms} ms
                      </span>
                    )}
                  </div>
                </div>

                {evt.ref_id && (
                  <p className="text-xs font-mono text-on-surface-variant">
                    Reference Target: <span className="text-primary font-semibold">{evt.ref_id}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineView;
