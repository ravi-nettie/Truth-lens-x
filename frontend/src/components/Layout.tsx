import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import {
  ShieldCheck,
  Plus,
  Folder,
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
  ChevronRight,
  User,
} from "lucide-react";
import { MockRibbon } from "./MockRibbon";
import { EvidenceStrengthLegend } from "./EvidenceStrengthLegend";
import { api, SchemaCaseResponse } from "../api/client";

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

  // If activeCaseId is present, fetch case details
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

  // Active case fallback for navigation links
  const targetCaseId = activeCaseId || (cases.length > 0 ? cases[0].id : null);

  // Compute breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === "/") return { section: "Workbench", title: "Landing Overview" };
    if (path === "/cases/new") return { section: "Investigations", title: "New Investigation" };
    if (path === "/history") return { section: "Repository", title: "Investigations Directory" };

    if (activeCaseId) {
      const caseLabel = activeCase?.title
        ? activeCase.title.slice(0, 24) + (activeCase.title.length > 24 ? "…" : "")
        : `Case ${activeCaseId.slice(0, 14)}`;
      if (path === `/cases/${activeCaseId}`) return { section: caseLabel, title: "Dashboard & Triage" };
      if (path.endsWith("/image")) return { section: caseLabel, title: "Image Analysis" };
      if (path.endsWith("/video")) return { section: caseLabel, title: "Video Analysis" };
      if (path.endsWith("/audio")) return { section: caseLabel, title: "Audio Analysis" };
      if (path.endsWith("/text")) return { section: caseLabel, title: "Text Cross-Exam" };
      if (path.endsWith("/graph")) return { section: caseLabel, title: "Correlation Graph" };
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
    <div className="flex flex-col justify-between h-full text-slate-200">
      {/* Top Branding & Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight text-white tracking-tight">
              TruthLens X
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Digital Forensics
            </span>
          </div>
        </div>

        {/* Global Workbench Navigation */}
        <div className="px-3 py-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1.5 font-mono">
            Workbench
          </div>
          <nav className="flex flex-col gap-0.5">
            <Link
              to="/"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLinkActive("/")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Landing</span>
            </Link>

            <Link
              to="/cases/new"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLinkActive("/cases/new")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>New Investigation</span>
            </Link>

            <Link
              to="/history"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLinkActive("/history")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Folder className="h-4 w-4" />
              <span>Investigations Directory</span>
            </Link>
          </nav>
        </div>

        {/* Active Case Inspection Navigation */}
        <div className="px-3 py-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between px-3 mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Active Investigation
            </span>
            {activeCase && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold truncate max-w-[80px]">
                {activeCase.status}
              </span>
            )}
          </div>

          <nav className="flex flex-col gap-0.5">
            <Link
              to={targetCaseId ? `/cases/${targetCaseId}` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCaseId && location.pathname === `/cases/${activeCaseId}`
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Case Dashboard</span>
            </Link>

            {/* Media Modalities */}
            <div className="pt-2 pb-0.5 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Media Modalities
            </div>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/image` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/image")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
              <span>Image Analysis</span>
            </Link>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/video` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/video")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Film className="h-3.5 w-3.5 text-sky-400" />
              <span>Video Analysis</span>
            </Link>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/audio` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/audio")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Music className="h-3.5 w-3.5 text-emerald-400" />
              <span>Audio Analysis</span>
            </Link>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/text` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors pl-5 ${
                activeCaseId && location.pathname.endsWith("/text")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              <span>Text Cross-Exam</span>
            </Link>

            {/* Cross-Modal & Reports */}
            <div className="pt-2 pb-0.5 px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Cross-Modal & Reports
            </div>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/graph` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/graph")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <GitBranch className="h-4 w-4 text-emerald-400" />
              <span>Correlation Graph</span>
            </Link>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/timeline` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/timeline")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Calendar className="h-4 w-4 text-purple-400" />
              <span>Provenance Timeline</span>
            </Link>

            <Link
              to={targetCaseId ? `/cases/${targetCaseId}/report` : "/cases/new"}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCaseId && location.pathname.endsWith("/report")
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-400" />
              <span>Forensic Report</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Bottom Footer Section: Offline stamp, Strength Legend, Profile */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <button
          type="button"
          onClick={() => setIsLegendOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-blue-400" />
            <span>Strength Legend</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">4-Tier</span>
        </button>

        {/* Offline Privacy Stamp */}
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>100% Offline · Local-First</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Mode 0444 read-only store. Zero cloud transmissions.
          </p>
        </div>

        {/* Analyst Profile */}
        <div className="flex items-center gap-2.5 pt-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
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
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans flex flex-col">
      {/* 1. Mandatory Mock Data Ribbon (only when active) */}
      <MockRibbon />

      {/* 2. Application Shell Grid */}
      <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left Desktop Sidebar (260px, sticky top-0, height 100vh) */}
        <aside className="hidden lg:flex flex-col justify-between sticky top-0 h-screen w-[260px] bg-[#14243B] text-slate-200 z-30 select-none overflow-y-auto border-r border-slate-800/80">
          {sidebarContent}
        </aside>

        {/* Mobile Slide-over Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="relative w-[260px] h-full bg-[#14243B] text-slate-200 z-50 shadow-2xl overflow-y-auto">
              <div className="absolute top-4 right-4 text-white">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-800 text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Workspace (Takes all remaining horizontal space) */}
        <div className="min-w-0 flex flex-col flex-1 bg-white">
          {/* Top Offline Privacy & Forensic Operational Banner */}
          <div className="bg-[#0b1523] border-b border-slate-800 text-[11px] text-slate-300 py-1 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-400">
                Local-First · Offline · Processing on this machine
              </span>
              <span className="hidden md:inline text-slate-400">
                | Zero cloud calls · Mode 0444 read-only evidence store
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLegendOpen(true)}
              className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white transition-colors font-medium cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Evidence-Strength Legend</span>
              <span className="sm:hidden">Legend</span>
            </button>
          </div>

          {/* Top Header Bar (sticky top-0, height 64px, flex-shrink 0) */}
          <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between px-4 sm:px-6 shrink-0">
            {/* Left: Mobile Toggle, Breadcrumbs & Case Selector */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Breadcrumb Hierarchy */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                <Link to="/history" className="hover:text-slate-900 transition-colors font-medium shrink-0">
                  {breadcrumbs.section}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">
                  {breadcrumbs.title}
                </span>
              </div>

              {/* Quick Case Selector */}
              {cases.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200">
                  <select
                    aria-label="Active Case Selector"
                    value={activeCaseId || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        navigate(`/cases/${e.target.value}`);
                      }
                    }}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-md px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none max-w-[190px] truncate"
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

            {/* Right: New Case CTA & User Avatar */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/cases/new"
                className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Case</span>
              </Link>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-xs select-none">
                AV
              </div>
            </div>
          </header>

          {/* Page Content (.page-content: width 100%, min-width 0, natural flow) */}
          <main className="w-full min-w-0 flex-1 p-6 lg:p-8 bg-white">
            {children || <Outlet />}
          </main>

          {/* Enterprise Forensic Footer */}
          <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-4 px-6 text-center text-xs text-slate-500">
            <p className="max-w-4xl mx-auto leading-relaxed">
              TruthLens X · Decision-Support Workbench · 100% Offline Local-First Architecture · Rule-Based Forensic Evidence Scoring · Zero Global Fake Probabilities · Mode 0444 Immutable Evidence Store
            </p>
          </footer>
        </div>
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
