import React from "react";
import { X, Lock, ShieldCheck } from "lucide-react";
import { SchemaEvidenceResponse } from "../api/client";
import { EvidenceViewer } from "./EvidenceViewer";

interface EvidenceDrawerProps {
  evidence: SchemaEvidenceResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onVerified?: (match: boolean) => void;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  evidence,
  isOpen,
  onClose,
  onDeleted,
  onVerified,
}) => {
  if (!isOpen || !evidence) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-outline-variant flex flex-col justify-between overflow-y-auto">
          {/* Drawer Header */}
          <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-primary-container text-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Evidence File Inspector</h3>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  Cryptographic Integrity & Metadata Telemetry
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 flex-1 space-y-6">
            <EvidenceViewer
              evidence={evidence}
              onDeleted={() => {
                onClose();
                if (onDeleted) onDeleted();
              }}
              onVerified={onVerified}
            />
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between text-xs text-on-surface-variant font-mono">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <Lock className="h-3 w-3" />
              Mode 0444 Immutable
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-white hover:bg-surface-container text-on-surface border border-outline-variant font-medium transition-colors shadow-sm"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceDrawer;
