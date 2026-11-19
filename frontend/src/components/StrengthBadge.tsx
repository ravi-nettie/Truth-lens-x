import React from "react";

export type StrengthLevel = "informational" | "weak" | "moderate" | "strong" | string;

interface StrengthBadgeProps {
  strength: StrengthLevel;
  className?: string;
}

export const StrengthBadge: React.FC<StrengthBadgeProps> = ({ strength, className = "" }) => {
  const norm = (strength || "").toLowerCase();

  let styles = "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
  let label = "Informational";

  if (norm === "weak") {
    styles = "bg-[#EFF6FF] text-[#2563EB] border-[rgba(37,99,235,0.25)]";
    label = "Weak Evidence";
  } else if (norm === "moderate") {
    styles = "bg-[#FFF5E6] text-[#D97706] border-[rgba(217,119,6,0.25)]";
    label = "Moderate Evidence";
  } else if (norm === "strong") {
    styles = "bg-[#FDEBEC] text-[#DC2626] border-[rgba(220,38,38,0.25)]";
    label = "Strong Evidence";
  } else {
    styles = "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
    label = "Informational";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase shadow-sm ${styles} ${className}`}
    >
      {label}
    </span>
  );
};

