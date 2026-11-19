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
    <div className="flex flex-col gap-3 pb-0 bg-white">
      {/* Top Case Title, Status & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {caseData?.title || `Case ${caseId}`}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide capitalize border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              {statusLabel}
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm">
            {caseData?.description || "Digital media forensics investigation and multimodal integrity verification."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/cases/${caseId}/report`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs hover:bg-slate-100 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Report</span>
          </Link>
        </div>
      </div>

      {/* Stitch 4-Tab Main Navigation Bar */}
      <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 pt-2 overflow-x-auto scrollbar-none">
        {/* Tab 1: Media Analysis */}
        <div className="relative group">
          <Link
            to={`/cases/${caseId}`}
            className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
              isMediaActive
                ? "text-blue-600 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlayCircle className={`h-4 w-4 ${isMediaActive ? "text-blue-600" : "text-slate-500"}`} />
            <span>Media Analysis</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            {isMediaActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full" />
            )}
          </Link>

          {/* Sub-modality Quick Hover Menu */}
          <div className="hidden group-hover:flex absolute top-full left-0 mt-0.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-30 flex-col py-1">
            <Link
              to={`/cases/${caseId}`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 transition-colors font-medium"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-blue-600" />
              <span>Overview Dashboard</span>
            </Link>
            <Link
              to={`/cases/${caseId}/image`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 transition-colors font-medium"
            >
              <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>Still Imagery (ELA/EXIF)</span>
            </Link>
            <Link
              to={`/cases/${caseId}/video`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 transition-colors font-medium"
            >
              <Film className="h-3.5 w-3.5 text-sky-600" />
              <span>Video Stream (Frames/PTS)</span>
            </Link>
            <Link
              to={`/cases/${caseId}/audio`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 transition-colors font-medium"
            >
              <Music className="h-3.5 w-3.5 text-emerald-600" />
              <span>Acoustic Audio Waveform</span>
            </Link>
            <Link
              to={`/cases/${caseId}/text`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 transition-colors font-medium"
            >
              <FileText className="h-3.5 w-3.5 text-amber-600" />
              <span>Text Cross-Examination</span>
            </Link>
          </div>
        </div>

        {/* Tab 2: Correlation */}
        <Link
          to={`/cases/${caseId}/graph`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isCorrelationActive
              ? "text-blue-600 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GitBranch className={`h-4 w-4 ${isCorrelationActive ? "text-blue-600" : "text-slate-500"}`} />
          <span>Correlation</span>
          {isCorrelationActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full" />
          )}
        </Link>

        {/* Tab 3: Timeline */}
        <Link
          to={`/cases/${caseId}/timeline`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isTimelineActive
              ? "text-blue-600 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className={`h-4 w-4 ${isTimelineActive ? "text-blue-600" : "text-slate-500"}`} />
          <span>Timeline</span>
          {isTimelineActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full" />
          )}
        </Link>

        {/* Tab 4: Report */}
        <Link
          to={`/cases/${caseId}/report`}
          className={`relative flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium transition-colors ${
            isReportActive
              ? "text-blue-600 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className={`h-4 w-4 ${isReportActive ? "text-blue-600" : "text-slate-500"}`} />
          <span>Report</span>
          {isReportActive && (
            <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full" />
          )}
        </Link>
      </div>

      {/* Secondary Sub-modality Pills when in Media Analysis */}
      {isMediaActive && (
        <div className="flex items-center gap-2 pt-1 pb-1 overflow-x-auto text-xs font-medium">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1 font-mono">
            Modality:
          </span>
          <Link
            to={`/cases/${caseId}`}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${
              location.pathname === `/cases/${caseId}`
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Evidence
          </Link>
          <Link
            to={`/cases/${caseId}/image`}
            className={`px-3 py-1 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/image")
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Still Image
          </Link>
          <Link
            to={`/cases/${caseId}/video`}
            className={`px-3 py-1 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/video")
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Film className="h-3.5 w-3.5" /> Video Stream
          </Link>
          <Link
            to={`/cases/${caseId}/audio`}
            className={`px-3 py-1 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/audio")
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Music className="h-3.5 w-3.5" /> Spoken Audio
          </Link>
          <Link
            to={`/cases/${caseId}/text`}
            className={`px-3 py-1 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
              location.pathname.endsWith("/text")
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Post Caption
          </Link>
        </div>
      )}
    </div>
  );
};

export default CaseHeaderTabs;
