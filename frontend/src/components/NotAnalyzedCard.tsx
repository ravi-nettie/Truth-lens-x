import React from "react";
import { AlertTriangle, Clock, HelpCircle } from "lucide-react";

interface NotAnalyzedCardProps {
  analyzerName: string;
  status: "failed" | "skipped_missing_model" | "pending" | string;
  reason?: string | null;
  error?: string | null;
  className?: string;
}

export const NotAnalyzedCard: React.FC<NotAnalyzedCardProps> = ({
  analyzerName,
  status,
  reason,
  error,
  className = "",
}) => {
  const isFailed = status === "failed";
  const isSkipped = status === "skipped_missing_model";

  const resolvedReason =
    reason ||
    error ||
    (isSkipped
      ? "Optional offline model weights not found in models/ directory. Run 'scripts/download_models.py' during setup to enable."
      : isFailed
      ? "Analyzer encountered execution failure or safe subprocess timeout."
      : "Pending execution in pipeline queue.");

  return (
    <div
      className={`rounded border border-outline-variant/70 bg-surface-container-low p-4 text-xs text-on-surface-variant shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-on-surface uppercase tracking-wider text-[11px] font-mono">
          {analyzerName}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
            isFailed
              ? "bg-[#FDEBEC] text-[#DC2626] border border-rose-200"
              : isSkipped
              ? "bg-[#FFF5E6] text-[#D97706] border border-amber-200"
              : "bg-surface-container text-on-surface-variant border border-outline-variant"
          }`}
        >
          {isFailed ? (
            <AlertTriangle className="h-3 w-3" />
          ) : isSkipped ? (
            <HelpCircle className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {status}
        </span>
      </div>

      <div className="rounded border border-outline-variant bg-white p-2.5 font-mono text-[11px]">
        <span className="font-semibold text-on-surface block mb-0.5">
          Not analyzed: {resolvedReason}
        </span>
        <p className="text-on-surface-variant text-[10px] leading-relaxed">
          Forensic safety rule: Missing or failed analyzer runs are never silently omitted or hidden.
        </p>
      </div>
    </div>
  );
};

export default NotAnalyzedCard;
