import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  Folder,
  History as HistoryIcon,
  Home,
  LayoutDashboard,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  GitBranch,
  Calendar,
  FileSpreadsheet,
  HelpCircle,
  Menu,
  X,
  CheckCircle2,
  Circle,
  ChevronRight,
  HardDrive,
  User,
} from "lucide-react";
import { MockRibbon } from "./MockRibbon";
import { EvidenceStrengthLegend } from "./EvidenceStrengthLegend";
import { api, SchemaCaseResponse } from "../api/client";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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

  // Compute breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === "/") return { section: "Workbench", title: "Landing Overview" };
    if (path === "/cases/new") return { section: "Investigations", title: "New Investigation" };
    if (path === "/history") return { section: "Repository", title: "Case History Directory" };

    if (activeCaseId) {
      const caseLabel = activeCase?.title ? activeCase.title.slice(0, 28) + (activeCase.title.length > 28 ? "…" : "") : `Case ${activeCaseId}`;
      if (path === `/cases/${activeCaseId}`) return { section: caseLabel, title: "Dashboard & Triage" };
      if (path.endsWith("/image")) return { section: caseLabel, title: "Image Analysis" };
      if (path.endsWith("/video")) return { section: caseLabel, title: "Video Analysis" };
      if (path.endsWith("/audio")) return { section: caseLabel, title: "Audio Analysis" };
      if (path.endsWith("/text")) return { section: caseLabel, title: "Text Cross-Exam" };
      if (path.endsWith("/graph")) return { section: caseLabel, title: "Cross-Modal Correlation Graph" };
      if (path.endsWith("/timeline")) return { section: caseLabel, title: "Provenance Timeline" };
      if (path.endsWith("/report")) return { section: caseLabel, title: "Forensic Report" };
      return { section: "Investigations", title: caseLabel };
    }
    return { section: "TruthLens X", title: "Forensic Workbench" };
  };

  const breadcrumbs = getBreadcrumbs();

  const isLinkActive = (to: string) => {
    if (to === "/" && location.pathname === "/") return true;
    if (to !== "/" && location.pathname === to) return true;
    return false;
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-inverse-on-surface">
      {/* Top Branding & Main Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-6 py-5 flex items-start gap-3 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded bg-primary-container text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[20px] leading-tight text-white tracking-tight">
              TruthLens X
            </span>
            <span className="text-[11px] font-semibold text-secondary-fixed-dim uppercase tracking-wider mt-0.5">
              Digital Forensics
            </span>
          </div>
        </div>

        {/* Global Navigation Links */}
        <div className="px-4 py-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
            Workbench
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              to="/"
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                isLinkActive("/")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Landing</span>
            </Link>

            <Link
              to="/cases/new"
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                isLinkActive("/cases/new")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>New Investigation</span>
            </Link>

            <Link
              to="/history"
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                isLinkActive("/history")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Folder className="h-4 w-4" />
              <span>Investigations Directory</span>
            </Link>
          </nav>
        </div>

        {/* Active Case Inspection Links (11 Modules Accessible) */}
        <div className="px-4 py-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between px-3 mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Active Investigation
            </span>
            {activeCase && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 font-semibold truncate max-w-[100px]">
                {activeCase.status}
              </span>
            )}
          </div>

          <nav className="flex flex-col gap-0.5">
            {/* 3. Dashboard */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCaseId && location.pathname === `/cases/${activeCaseId}`
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Case Dashboard</span>
            </Link>

            {/* Sub-group: Modality Analysis */}
            <div className="pt-1.5 pb-0.5 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Media Modalities
            </div>

            {/* 4. Image */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/image` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/image")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Image Analysis</span>
            </Link>

            {/* 5. Video */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/video` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/video")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              <span>Video Analysis</span>
            </Link>

            {/* 6. Audio */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/audio` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/audio")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              <span>Audio Analysis</span>
            </Link>

            {/* 7. Text */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/text` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/text")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Text Cross-Exam</span>
            </Link>

            {/* Cross-Modal & Reporting */}
            <div className="pt-1.5 pb-0.5 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Cross-Modal & Reports
            </div>

            {/* 8. Graph [USP 1] */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/graph` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/graph")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <GitBranch className="h-4 w-4 text-emerald-400" />
              <span>Correlation Graph</span>
            </Link>

            {/* 9. Timeline [USP 2] */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/timeline` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/timeline")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Calendar className="h-4 w-4 text-amber-400" />
              <span>Provenance Timeline</span>
            </Link>

            {/* 10. Report */}
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/report` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/report")
                  ? "bg-primary-container text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-400" />
              <span>Forensic Report</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Bottom Footer Section: Offline info & Legend trigger */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <button
          type="button"
          onClick={() => setIsLegendOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary-container" />
            <span>Strength Legend</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">4-Tier</span>
        </button>

        {/* Offline Privacy Stamp */}
        <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>100% Offline · Local-First</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Mode 0444 read-only store. Zero cloud API transmissions.
          </p>
        </div>

        {/* Analyst Profile */}
        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold shadow-sm">
            AV
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white leading-none">Analyst Vance</span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">Forensic Unit 4</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-on-surface flex flex-col font-sans">
      {/* 1. Mandatory Mock Data Ribbon */}
      <MockRibbon />

      {/* 2. Desktop Vertical Navigation Sidebar (#14243B) */}
      <aside className="hidden lg:block fixed left-0 top-0 h-screen w-[280px] bg-inverse-surface z-50 select-none shadow-stitch overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-[280px] h-full bg-inverse-surface z-50 shadow-2xl overflow-y-auto">
            <div className="absolute top-4 right-4 text-white">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* 3. Main Workspace Area (Offset by 280px on desktop) */}
      <div className="lg:pl-[280px] flex-1 flex flex-col min-h-screen bg-white">
        {/* Top Header Bar */}
        <header className="fixed top-0 left-0 lg:left-[280px] right-0 h-16 bg-white/95 backdrop-blur-md border-b border-outline-variant z-40 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded hover:bg-surface-container-low text-on-surface-variant transition-colors"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Hierarchy matching Stitch */}
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Link to="/history" className="hover:text-on-surface transition-colors font-medium">
                {breadcrumbs.section}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-outline" />
              <span className="font-semibold text-on-surface truncate max-w-[200px] sm:max-w-[320px]">
                {breadcrumbs.title}
              </span>
            </div>

            {/* Quick Case Switcher */}
            {cases.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 pl-3 border-l border-outline-variant">
                <select
                  aria-label="Active Case Selector"
                  value={activeCaseId || ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      navigate(`/cases/${e.target.value}`);
                    }
                  }}
                  className="bg-surface-container-low border border-outline-variant text-on-surface text-xs rounded px-2.5 py-1 focus:ring-1 focus:ring-primary focus:outline-none max-w-[180px] truncate"
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

          {/* Right: 5-Stage Investigation Progress Bar & Primary Actions */}
          <div className="flex items-center gap-4">
            {/* 5-Stage Active Case Progress Indicator */}
            {activeCase && (
              <div className="hidden xl:flex items-center gap-1.5 bg-surface-container-low border border-outline-variant rounded px-2.5 py-1">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider mr-1">
                  Stage:
                </span>
                {STAGES.map((st, idx) => {
                  const isPassed = activeCase && (idx < activeIndex || (idx === activeIndex && isCompleted));
                  const isCurrent = activeCase && idx === activeIndex && !isCompleted;

                  return (
                    <React.Fragment key={st.id}>
                      <div
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase transition-all ${
                          isCurrent
                            ? "bg-primary-container text-white shadow-sm ring-1 ring-primary/20 animate-pulse"
                            : isPassed
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "text-on-surface-variant/70"
                        }`}
                      >
                        {isPassed ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : isCurrent ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        ) : (
                          <Circle className="h-2 w-2 text-outline" />
                        )}
                        <span>{st.label}</span>
                      </div>
                      {idx < STAGES.length - 1 && (
                        <span className="text-outline text-[9px] font-mono">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/cases/new"
                className="h-8 px-3 bg-primary-container hover:bg-primary text-white text-xs font-semibold rounded shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Case</span>
              </Link>
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm select-none">
                AV
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full pt-16 flex-1 bg-white">
          {children || <Outlet />}
        </main>

        {/* Enterprise Forensic Footer */}
        <footer className="border-t border-outline-variant bg-surface-container-low py-4 px-6 text-center text-xs text-on-surface-variant">
          <p className="max-w-4xl mx-auto leading-relaxed">
            TruthLens X · Decision-Support Workbench · 100% Offline Local-First Architecture · Rule-Based Forensic Evidence Scoring · Zero Global Fake Probabilities · Mode 0444 Immutable Evidence Store
          </p>
        </footer>
      </div>

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
