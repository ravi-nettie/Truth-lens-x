import React, { useState } from "react";
import {
  FileCheck2,
  Lock,
  RotateCw,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { api, SchemaEvidenceResponse } from "../api/client";

interface EvidenceViewerProps {
  evidence: SchemaEvidenceResponse;
  onDeleted?: () => void;
  onVerified?: (match: boolean) => void;
  className?: string;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  evidence,
  onDeleted,
  onVerified,
  className = "",
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    match: boolean;
    expected: string;
    actual: string;
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleVerifyHash = async () => {
    setIsVerifying(true);
    try {
      const res = await api.verifyEvidenceHash(evidence.id);
      const outcome = {
        verified: true,
        match: res.match,
        expected: res.expected_sha256,
        actual: res.actual_sha256,
      };
      setVerificationResult(outcome);
      if (onVerified) onVerified(res.match);
    } catch {
      setVerificationResult({
        verified: true,
        match: false,
        expected: evidence.sha256,
        actual: "Failed to read file",
      });
      if (onVerified) onVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteEvidence(evidence.id, true);
      setShowDeleteModal(false);
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete evidence file.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format file size
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const meta = (evidence as any).metadata || {};

  return (
    <div className={`rounded border border-outline-variant bg-white p-5 space-y-4 shadow-sm ${className}`}>
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
            <FileCheck2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <span>{evidence.filename}</span>
              <span className="rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide border border-outline-variant">
                {evidence.modality}
              </span>
            </h4>
            <span className="text-[10px] font-mono text-on-surface-variant">ID: {evidence.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Read-Only 0444 Permission Badge */}
          <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Lock className="h-3 w-3" />
            mode 0444 (Read-Only)
          </span>
        </div>
      </div>

      {/* SHA-256 Badge & Verification State */}
      <div className="rounded border border-outline-variant bg-surface-container-low p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-semibold text-on-surface-variant uppercase tracking-wider">
            Cryptographic SHA-256 Hash
          </span>
          {verificationResult && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                verificationResult.match
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {verificationResult.match ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Hash Match Verified
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  Hash Mismatch Detected
                </>
              )}
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-primary break-all bg-white p-2 rounded border border-outline-variant select-all">
          {evidence.sha256}
        </p>
      </div>

      {/* Metadata Table */}
      <div className="rounded border border-outline-variant bg-surface-container-low p-3 space-y-2">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
          Ingestion & File System Metadata
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="space-y-0.5">
            <span className="text-[10px] text-on-surface-variant block">File Size</span>
            <span className="text-on-surface font-semibold">{formatBytes(evidence.file_size_bytes)}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-on-surface-variant block">MIME Type</span>
            <span className="text-on-surface">{evidence.mime_type}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-on-surface-variant block">Storage Path</span>
            <span className="text-on-surface-variant truncate block" title={evidence.file_path}>
              {evidence.file_path || "data/evidence/..."}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-on-surface-variant block">Created At</span>
            <span className="text-on-surface-variant">{new Date(evidence.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Extra Stream/Exif Details if present in metadata */}
        {(meta.width || meta.height || meta.duration_sec || meta.fps || meta.sample_rate) && (
          <div className="pt-2 border-t border-outline-variant grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-on-surface">
            {meta.width && meta.height && (
              <div>
                <span className="text-[10px] text-on-surface-variant block">Resolution</span>
                <span>{meta.width} × {meta.height} px</span>
              </div>
            )}
            {meta.duration_sec && (
              <div>
                <span className="text-[10px] text-on-surface-variant block">Duration</span>
                <span>{meta.duration_sec} s</span>
              </div>
            )}
            {meta.fps && (
              <div>
                <span className="text-[10px] text-on-surface-variant block">Framerate</span>
                <span>{meta.fps} fps</span>
              </div>
            )}
            {meta.sample_rate && (
              <div>
                <span className="text-[10px] text-on-surface-variant block">Sample Rate</span>
                <span>{meta.sample_rate} Hz</span>
              </div>
            )}
          </div>
        )}

        {evidence.source_note && (
          <div className="pt-2 border-t border-outline-variant text-xs">
            <span className="text-[10px] text-on-surface-variant block uppercase font-mono">Source Note</span>
            <p className="text-on-surface italic mt-0.5">"{evidence.source_note}"</p>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {/* Verify Hash Button */}
          <button
            type="button"
            onClick={handleVerifyHash}
            disabled={isVerifying}
            className="flex items-center gap-1.5 bg-white hover:bg-surface-container-low text-on-surface text-xs font-semibold px-3 py-1.5 rounded border border-outline-variant transition-colors disabled:opacity-50 shadow-sm"
          >
            {isVerifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <RotateCw className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Verify Hash</span>
          </button>

          {/* Download Original File */}
          <a
            href={`/api/evidence/${evidence.id}/file`}
            download={evidence.filename}
            className="flex items-center gap-1.5 bg-white hover:bg-surface-container-low text-on-surface text-xs font-semibold px-3 py-1.5 rounded border border-outline-variant transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>Download Original</span>
          </a>
        </div>

        {/* Delete Evidence Button */}
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors shadow-sm"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
          <span>Delete Evidence</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-on-surface">Permanently Delete Evidence?</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This action will remove <strong className="text-on-surface">{evidence.filename}</strong> and tombstone its cryptographic hash in the audit trail. Dependent observations will be deleted.
            </p>
            {deleteError && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded text-xs font-semibold bg-white hover:bg-surface-container-low text-on-surface border border-outline-variant transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 shadow-sm"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Permanent Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenceViewer;
