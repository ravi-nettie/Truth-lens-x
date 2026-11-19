import React from "react";
import { AlertTriangle, Database } from "lucide-react";

export const MockRibbon: React.FC = () => {
  const isMockActive = import.meta.env.VITE_USE_MOCKS === "true";

  if (!isMockActive) {
    return null;
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2.5 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider py-2 px-4 shadow-lg border-b border-amber-600 select-none"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-slate-950 stroke-[2.5]" />
      <span>MOCK DATA ACTIVE — NOT REAL ANALYSIS</span>
      <span className="hidden sm:inline font-mono font-medium text-[11px] lowercase opacity-80">
        (serving local test fixtures from shared/fixtures)
      </span>
      <Database className="h-3.5 w-3.5 shrink-0 opacity-70 hidden sm:inline" />
    </div>
  );
};


