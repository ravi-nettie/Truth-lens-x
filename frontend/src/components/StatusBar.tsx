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
  hasReport?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, className = "", hasReport = false }) => {
  const normStatus = (status || "created").toLowerCase();

  // Determine stage progression index (0 to 4)
  let activeIndex = 0;
  if (normStatus === "created") activeIndex = 0;
  else if (normStatus === "ingested") activeIndex = 1;
  else if (normStatus === "analyzing") activeIndex = 1;
  else if (normStatus === "analyzed") activeIndex = 2;
  else if (normStatus === "correlated") activeIndex = 3;
  else if (normStatus === "in_review") activeIndex = 3;
  else if (normStatus === "reported" || normStatus === "completed") activeIndex = 4;

  const isReported = normStatus === "reported" || normStatus === "completed" || hasReport;
  const isAnalyzing = normStatus === "analyzing";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {STAGES.map((stage, idx) => {
          // Completed if prior to active index, or if reported/has report for report stage
          const isPassed =
            idx < activeIndex ||
            (stage.id === "report" && isReported) ||
            (normStatus === "reported" && idx <= 4);

          const isCurrent = idx === activeIndex && !isPassed;

          // Only truly running tasks (like analyzing) should show an animated pulse
          const shouldPulse = isCurrent && isAnalyzing;

          let subtitle = "";
          if (isPassed) {
            subtitle = "Done";
          } else if (isCurrent) {
            if (stage.id === "analyze") subtitle = isAnalyzing ? "Running..." : "Completed";
            else if (stage.id === "correlate") subtitle = "Correlating...";
            else if (stage.id === "review") subtitle = "Ready for Review";
            else if (stage.id === "report") subtitle = "Available";
            else subtitle = "Active";
          } else if (stage.id === "report" && isReported) {
            subtitle = "Available";
          }

          return (
            <React.Fragment key={stage.id}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isPassed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                      : shouldPulse
                      ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-300 animate-pulse"
                      : isCurrent
                      ? "bg-blue-50 text-blue-700 border border-blue-300 font-semibold"
                      : "bg-slate-50 text-slate-400 border border-slate-200"
                  }`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div>
                  <span
                    className={`text-xs font-bold tracking-wider font-mono ${
                      isPassed
                        ? "text-emerald-800"
                        : isCurrent
                        ? "text-blue-700"
                        : "text-slate-400"
                    }`}
                  >
                    {stage.label}
                  </span>
                  {subtitle && (
                    <p
                      className={`text-[10px] -mt-0.5 font-medium ${
                        isPassed
                          ? "text-emerald-600"
                          : isCurrent
                          ? "text-blue-600"
                          : "text-slate-400"
                      }`}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {idx < STAGES.length - 1 && (
                <div className="hidden sm:flex flex-1 max-w-[56px] items-center justify-center">
                  <div
                    className={`h-0.5 w-full ${
                      idx < activeIndex || (idx === 3 && isReported)
                        ? "bg-emerald-400"
                        : "bg-slate-200"
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
