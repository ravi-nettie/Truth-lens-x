import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ShieldCheck, HardDrive, PlusCircle, FolderGit2, Cpu } from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { id: activeCaseId } = useParams<{ id: string }>();
  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);

  useEffect(() => {
    api
      .getCases()
      .then((res) => setCases(res.cases || []))
      .catch(() => {});
  }, [activeCaseId]);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                TruthLens<span className="text-indigo-500"> X</span>
              </span>
              <span className="block text-[10px] text-slate-400 -mt-1 font-mono uppercase tracking-wider">
                Multimodal Forensics
              </span>
            </div>
          </Link>

          {/* Local-First Badge */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            <Cpu className="h-3.5 w-3.5 animate-pulse" />
            <span className="font-medium tracking-tight">
              Local-First: Processing on this machine · Offline Ready
            </span>
          </div>
        </div>

        {/* Case Selector & Actions */}
        <div className="flex items-center gap-3">
          {cases.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-slate-400 hidden sm:block" />
              <select
                aria-label="Active Case Selector"
                value={activeCaseId || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/cases/${e.target.value}`);
                  }
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none max-w-[200px] truncate"
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

          <Link
            to="/cases/new"
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-sm transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New Case</span>
          </Link>

          <Link
            to="/history"
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded transition-colors hidden sm:block"
          >
            History
          </Link>
        </div>
      </div>
    </header>
  );
};

