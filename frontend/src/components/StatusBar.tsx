import React from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

const STAGES = [
  { id: "ingest", label: "INGEST" },
  { id: "analyze", label: "ANALYZE" },
  { id: "correlate", label: "CORRELATE" },
  { id: "review", label: "REVIEW" },
  { id: "report", label: "REPORT" },
] as const;

interface StatusBarProps {
  status: string;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, className = "" }) => {
  const normStatus = (status || "created").toLowerCase();

  // Determine stage progression index (0 to 4)
  let activeIndex = 0;
  if (normStatus === "created") activeIndex = 0;
  else if (normStatus === "ingested") activeIndex = 1;
  else if (normStatus === "analyzing") activeIndex = 1;
  else if (normStatus === "analyzed") activeIndex = 2;
  else if (normStatus === "correlated") activeIndex = 3;
  else if (normStatus === "in_review") activeIndex = 3;
  else if (normStatus === "reported") activeIndex = 4;

  const isCompleted = normStatus === "reported";

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-sm backdrop-blur ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {STAGES.map((stage, idx) => {
          const isPassed = idx < activeIndex || (idx === activeIndex && isCompleted);
          const isCurrent = idx === activeIndex && !isCompleted;
          const isPending = idx > activeIndex;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isPassed
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : isCurrent
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50 animate-pulse"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <span>{idx + 1}</span>
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-xs font-bold tracking-wider ${
                      isCurrent
                        ? "text-indigo-400"
                        : isPassed
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <p className="text-[10px] text-slate-400 -mt-0.5">In Progress</p>
                  )}
                </div>
              </div>

              {idx < STAGES.length - 1 && (
                <div className="hidden sm:flex flex-1 max-w-[48px] items-center justify-center">
                  <div
                    className={`h-0.5 w-full ${
                      idx < activeIndex ? "bg-emerald-500/40" : "bg-slate-800"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

