import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import {
  ShieldCheck,
  Cpu,
  PlusCircle,
  FolderGit2,
  Layers,
  HelpCircle,
  Film,
  Image as ImageIcon,
  Music,
  FileText,
  GitBranch,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  Circle,
  ChevronDown,
} from "lucide-react";
import { MockRibbon } from "./MockRibbon";
import { EvidenceStrengthLegend } from "./EvidenceStrengthLegend";
import { api, SchemaCaseResponse, SchemaCaseDetailResponse } from "../api/client";

const STAGES = [
  { id: "ingest", label: "INGEST" },
  { id: "analyze", label: "ANALYZE" },
  { id: "correlate", label: "CORRELATE" },
  { id: "review", label: "REVIEW" },
  { id: "report", label: "REPORT" },
] as const;

export const Layout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract caseId from route if present (e.g. /cases/:id/...)
  const pathMatch = location.pathname.match(/^\/cases\/([^/]+)/);
  const activeCaseId = pathMatch && pathMatch[1] !== "new" ? pathMatch[1] : null;

  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);
  const [activeCase, setActiveCase] = useState<SchemaCaseResponse | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Load available cases
  useEffect(() => {
    api
      .getCases()
      .then((res) => {
        const list = res.cases || [];
        setCases(list);
        if (activeCaseId) {
          const found = list.find((c) => c.id === activeCaseId);
          if (found) setActiveCase(found);
        }
      })
      .catch(() => {});
  }, [activeCaseId]);

  // If activeCaseId is present, fetch case details to get current status
  useEffect(() => {
    if (activeCaseId) {
      api
        .getCase(activeCaseId)
        .then((res) => {
          setActiveCase(res.case);
        })
        .catch(() => {});
    } else {
      setActiveCase(null);
    }
  }, [activeCaseId, location.pathname]);

  // Determine stage progression index (0 to 4)
  const normStatus = (activeCase?.status || "created").toLowerCase();
  let activeIndex = 0;
  if (normStatus === "created") activeIndex = 0;
  else if (normStatus === "ingested") activeIndex = 1;
  else if (normStatus === "analyzing") activeIndex = 1;
  else if (normStatus === "analyzed") activeIndex = 2;
  else if (normStatus === "correlated") activeIndex = 3;
  else if (normStatus === "in_review") activeIndex = 3;
  else if (normStatus === "reported") activeIndex = 4;

  const isCompleted = normStatus === "reported";

  // Active case fallback for navigation links
  const targetCaseId = activeCaseId || (cases.length > 0 ? cases[0].id : null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* 1. Mandatory Mock Data Ribbon */}
      <MockRibbon />

      {/* 2. Top Privacy & Forensic Operational Banner */}
      <div className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 py-1 px-4 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">Local-First · Offline · Processing on this machine</span>
            <span className="hidden md:inline text-slate-500">| Zero cloud calls · Mode 0444 read-only evidence store</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsLegendOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Evidence-Strength Legend</span>
            </button>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="font-mono text-slate-500 text-[10px] hidden sm:inline">SHA-256 Chained</span>
          </div>
        </div>
      </div>

      {/* 3. Main Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Branding */}
            <div className="flex items-center gap-5">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                    TruthLens<span className="text-indigo-500"> X</span>
                  </span>
                  <span className="block text-[10px] text-slate-400 -mt-1 font-mono uppercase tracking-wider">
                    Forensic Workbench
                  </span>
                </div>
              </Link>

              {/* Active Case Selector */}
              {cases.length > 0 && (
                <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Case:</span>
                  <select
                    aria-label="Active Case Selector"
                    value={activeCaseId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        navigate(`/cases/${e.target.value}`);
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-[200px] truncate"
                  >
                    <option value="" disabled>
                      Select Case...
                    </option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 5-Stage Active Case Progress Bar (In Top Bar) */}
            <div className="hidden xl:flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-2">
                Stage:
              </span>
              {STAGES.map((st, idx) => {
                const isPassed = activeCase && (idx < activeIndex || (idx === activeIndex && isCompleted));
                const isCurrent = activeCase && idx === activeIndex && !isCompleted;

                return (
                  <React.Fragment key={st.id}>
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase transition-all ${
                        isCurrent
                          ? "bg-indigo-600 text-white shadow ring-1 ring-indigo-400 animate-pulse"
                          : isPassed
                          ? "bg-emerald-950/70 text-emerald-400 border border-emerald-800/60"
                          : "text-slate-500"
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : isCurrent ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      ) : (
                        <Circle className="h-2.5 w-2.5 text-slate-600" />
                      )}
                      <span>{st.label}</span>
                    </div>
                    {idx < STAGES.length - 1 && (
                      <span className="text-slate-700 text-[10px] font-mono">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <Link
                to="/cases/new"
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">New Case</span>
              </Link>
              <Link
                to="/history"
                className="text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
              >
                <FolderGit2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">History</span>
              </Link>
            </div>
          </div>

          {/* 4. Complete 11-View Workbench Sub-Navigation Bar */}
          <nav className="flex items-center gap-1 overflow-x-auto py-2 text-xs font-medium border-t border-slate-900/80 scrollbar-none">
            {/* View 1: Landing */}
            <Link
              to="/"
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                location.pathname === "/"
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              1. Landing
            </Link>

            {/* View 2: New Case */}
            <Link
              to="/cases/new"
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                location.pathname === "/cases/new"
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              2. New Case
            </Link>

            <span className="text-slate-700 shrink-0">|</span>

            {/* View 3: Dashboard */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors ${
                activeCaseId && location.pathname === `/cases/${activeCaseId}`
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3. Dashboard
            </Link>

            {/* View 4: Image */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/image` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/image")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ImageIcon className="h-3 w-3" />
              <span>4. Image</span>
            </Link>

            {/* View 5: Video */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/video` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/video")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Film className="h-3 w-3" />
              <span>5. Video</span>
            </Link>

            {/* View 6: Audio */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/audio` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/audio")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Music className="h-3 w-3" />
              <span>6. Audio</span>
            </Link>

            {/* View 7: Text */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/text` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/text")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="h-3 w-3" />
              <span>7. Text</span>
            </Link>

            <span className="text-slate-700 shrink-0">|</span>

            {/* View 8: Graph */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/graph` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/graph")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <GitBranch className="h-3 w-3" />
              <span>8. Graph</span>
            </Link>

            {/* View 9: Timeline */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/timeline` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/timeline")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>9. Timeline</span>
            </Link>

            {/* View 10: Report */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/report` : "/cases/new"}
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                activeCaseId && location.pathname.endsWith("/report")
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>10. Report</span>
            </Link>

            <span className="text-slate-700 shrink-0">|</span>

            {/* View 11: History */}
            <Link
              to="/history"
              className={`px-2.5 py-1 rounded-md shrink-0 transition-colors flex items-center gap-1 ${
                location.pathname === "/history"
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>11. History</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Investigation Content Shell */}
      <main className="flex-1 pb-16">
        {children || <Outlet />}
      </main>

      {/* Forensic Compliance Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <p className="max-w-4xl mx-auto leading-relaxed">
          TruthLens X · Decision-support forensic workbench · 100% Offline Local-First Architecture · Rule-Based Forensic Evidence Scoring · Zero Global Fake Probabilities · Mode 0444 Immutable Evidence Store
        </p>
      </footer>

      {/* Evidence-Strength Legend Modal */}
      <EvidenceStrengthLegend
        isModal
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
      />
    </div>
  );
};

export default Layout;
