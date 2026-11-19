import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

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
    <div className={`rounded border border-outline-variant bg-white p-4 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {STAGES.map((stage, idx) => {
          const isPassed = idx < activeIndex || (idx === activeIndex && isCompleted);
          const isCurrent = idx === activeIndex && !isCompleted;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                      : isCurrent
                      ? "bg-primary-container text-white shadow-sm ring-2 ring-primary/20 animate-pulse"
                      : "bg-surface-container-low text-on-surface-variant border border-outline-variant"
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <span>{idx + 1}</span>
                  ) : (
                    <Circle className="h-3 w-3 text-on-surface-variant/50" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-xs font-bold tracking-wider ${
                      isCurrent
                        ? "text-primary"
                        : isPassed
                        ? "text-emerald-700"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {isCurrent && (
                    <p className="text-[10px] text-on-surface-variant -mt-0.5">In Progress</p>
                  )}
                </div>
              </div>

              {idx < STAGES.length - 1 && (
                <div className="hidden sm:flex flex-1 max-w-[48px] items-center justify-center">
                  <div
                    className={`h-0.5 w-full ${
                      idx < activeIndex ? "bg-emerald-300" : "bg-outline-variant"
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
