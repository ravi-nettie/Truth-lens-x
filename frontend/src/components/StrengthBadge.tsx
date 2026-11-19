import React from "react";

export type StrengthLevel = "informational" | "weak" | "moderate" | "strong" | string;

interface StrengthBadgeProps {
  strength: StrengthLevel;
  className?: string;
}

export const StrengthBadge: React.FC<StrengthBadgeProps> = ({ strength, className = "" }) => {
  const norm = strength.toLowerCase();

  let styles = "bg-slate-800 text-slate-300 border-slate-700";
  let label = "Informational";

  if (norm === "weak") {
    styles = "bg-sky-950/80 text-sky-300 border-sky-700/60";
    label = "Weak Evidence";
  } else if (norm === "moderate") {
    styles = "bg-amber-950/80 text-amber-300 border-amber-600/70";
    label = "Moderate Evidence";
  } else if (norm === "strong") {
    styles = "bg-rose-950/80 text-rose-300 border-rose-600/80";
    label = "Strong Evidence";
  } else {
    styles = "bg-slate-800 text-slate-300 border-slate-700";
    label = "Informational";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${styles} ${className}`}
    >
      {label}
    </span>
  );
};

