import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  PlayCircle,
  GitBranch,
  Calendar,
  FileSpreadsheet,
  Download,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import { SchemaCaseResponse } from "../api/client";

interface CaseHeaderTabsProps {
  caseData?: SchemaCaseResponse | null;
  caseId: string;
}

export const CaseHeaderTabs: React.FC<CaseHeaderTabsProps> = ({ caseData, caseId }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isMediaActive =
    location.pathname === `/cases/${caseId}` ||
    location.pathname.endsWith("/image") ||
    location.pathname.endsWith("/video") ||
    location.pathname.endsWith("/audio") ||
    location.pathname.endsWith("/text");

  const isCorrelationActive = location.pathname.endsWith("/graph");
  const isTimelineActive = location.pathname.endsWith("/timeline");
  const isReportActive = location.pathname.endsWith("/report");

  const statusLabel = caseData?.status ? caseData.status.replace("_", " ") : "In Analysis";

  return (
    <div className="flex flex-col gap-4 pb-0 bg-white">
      {/* Top Case Title, Status & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              {caseData?.title || `Case ${caseId}`}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#D0E0FF] text-[#0B1C32] text-xs font-semibold tracking-wide capitalize">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {statusLabel}
            </span>
          </div>
          <p className="text-on-surface-variant text-sm">
            {caseData?.description || "Digital media forensics investigation and multimodal integrity verification."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={`/cases/${caseId}/report`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-surface-container-low text-on-surface text-xs font-semibold border border-outline-variant shadow-sm hover:bg-surface-container transition-all"
          >
            <Download className="h-4 w-4 text-on-surface-variant" />
            <span>Export Report</span>
          </Link>
        </div>
      </div>

      {/* Stitch 4-Tab Main Navigation Bar */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-outline-variant pt-2 overflow-x-auto scrollbar-none">
        {/* Tab 1: Media Analysis */}
        <div className="relative group">
          <Link
            to={`/cases/${caseId}`}
            className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
              isMediaActive
                ? "text-on-surface font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <PlayCircle className={`h-4 w-4 ${isMediaActive ? "text-primary" : "text-on-surface-variant"}`} />
            <span>Media Analysis</span>
            <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
            {isMediaActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary-container rounded-full" />
            )}
          </Link>

          {/* Sub-modality Quick Hover Menu */}
          <div className="hidden group-hover:flex absolute top-full left-0 mt-0.5 w-48 bg-white border border-outline-variant rounded shadow-lg z-30 flex-col py-1 animate-fadeIn">
            <Link
              to={`/cases/${caseId}`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
              <span>Overview Dashboard</span>
            </Link>
            <Link
              to={`/cases/${caseId}/image`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>Still Imagery (ELA/EXIF)</span>
            </Link>
            <Link
              to={`/cases/${caseId}/video`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <Film className="h-3.5 w-3.5 text-indigo-600" />
              <span>Video Stream (Frames/PTS)</span>
            </Link>
            <Link
              to={`/cases/${caseId}/audio`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <Music className="h-3.5 w-3.5 text-amber-600" />
              <span>Acoustic Audio Waveform</span>
            </Link>
            <Link
              to={`/cases/${caseId}/text`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600" />
              <span>Text Cross-Examination</span>
            </Link>
          </div>
        </div>

        {/* Tab 2: Correlation */}
        <Link
          to={`/cases/${caseId}/graph`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isCorrelationActive
              ? "text-on-surface font-semibold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <GitBranch className={`h-4 w-4 ${isCorrelationActive ? "text-primary" : "text-on-surface-variant"}`} />
          <span>Correlation</span>
          {isCorrelationActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary-container rounded-full" />
          )}
        </Link>

        {/* Tab 3: Timeline */}
        <Link
          to={`/cases/${caseId}/timeline`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isTimelineActive
              ? "text-on-surface font-semibold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Calendar className={`h-4 w-4 ${isTimelineActive ? "text-primary" : "text-on-surface-variant"}`} />
          <span>Timeline</span>
          {isTimelineActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary-container rounded-full" />
          )}
        </Link>

        {/* Tab 4: Report */}
        <Link
          to={`/cases/${caseId}/report`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isReportActive
              ? "text-on-surface font-semibold"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <FileSpreadsheet className={`h-4 w-4 ${isReportActive ? "text-primary" : "text-on-surface-variant"}`} />
          <span>Report</span>
          {isReportActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-primary-container rounded-full" />
          )}
        </Link>
      </div>

      {/* Secondary Sub-modality Pills when in Media Analysis */}
      {isMediaActive && (
        <div className="flex items-center gap-2 pt-1 pb-1 overflow-x-auto text-xs font-medium">
          <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mr-1">
            Modality:
          </span>
          <Link
            to={`/cases/${caseId}`}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              location.pathname === `/cases/${caseId}`
                ? "bg-primary-container text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            All Evidence
          </Link>
          <Link
            to={`/cases/${caseId}/image`}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/image")
                ? "bg-primary-container text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            <ImageIcon className="h-3 w-3" /> Still Image
          </Link>
          <Link
            to={`/cases/${caseId}/video`}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/video")
                ? "bg-primary-container text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            <Film className="h-3 w-3" /> Video Stream
          </Link>
          <Link
            to={`/cases/${caseId}/audio`}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/audio")
                ? "bg-primary-container text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            <Music className="h-3 w-3" /> Spoken Audio
          </Link>
          <Link
            to={`/cases/${caseId}/text`}
            className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/text")
                ? "bg-primary-container text-white font-semibold shadow-sm"
                : "bg-surface-container-low text-on-surface hover:bg-surface-container"
            }`}
          >
            <FileText className="h-3 w-3" /> Post Caption
          </Link>
        </div>
      )}
    </div>
  );
};

export default CaseHeaderTabs;
