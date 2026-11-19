import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderGit2,
  FolderOpen,
  ArrowRight,
  Trash2,
  AlertTriangle,
  Layers,
  Calendar,
  Plus,
  Clock,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Search,
  Filter,
  FileDown,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());

  const fetchCases = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getCases();
      setCases(res.cases || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load case repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleDelete = async (caseId: string) => {
    setDeleting(true);
    setErrorMsg(null);
    try {
      await api.deleteCase(caseId);
      setDeleteConfirmId(null);
      await fetchCases();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete case.");
    } finally {
      setDeleting(false);
    }
  };

  const selectedCaseToDelete = cases.find((c) => c.id === deleteConfirmId);

  // Filtered cases list
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (c.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [cases, searchQuery, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedCaseIds.size === filteredCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(filteredCases.map((c) => c.id)));
    }
  };

  const toggleSelectCase = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportSummaryJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cases, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `truthlens_cases_export_${new Date().toISOString().split("T")[0]}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Header Block: Title & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight">
              Investigations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200">
              {cases.length} Total Cases
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage active digital forensics cases, evidence integrity checks, and ongoing investigations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchCases}
            className="h-9 px-3 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5"
            title="Refresh repository"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportSummaryJSON}
            disabled={cases.length === 0}
            className="h-9 px-3.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4 text-slate-500" />
            <span>Export Summary</span>
          </button>

          <Link
            to="/cases/new"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New Investigation</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Quick Telemetry & Filter Rail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Forensic Omnisearch Bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by case ID, title, or contextual vectors..."
              className="w-full h-10 pl-10 pr-12 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-lg text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <kbd className="absolute right-3 top-2.5 px-1.5 py-0.5 rounded bg-slate-200/80 text-[10px] font-mono text-slate-500 font-medium">
              /
            </kbd>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Status: All</option>
              <option value="completed">Completed</option>
              <option value="running">Running / In Analysis</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="h-10 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Views */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 overflow-x-auto text-nowrap text-xs">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mr-1">Views:</span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Investigations ({cases.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "completed"
                ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Completed Audits ({cases.filter((c) => c.status === "completed").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("running")}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === "running"
                ? "bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            In Analysis ({cases.filter((c) => c.status === "running").length})
          </button>
        </div>
      </div>

      {/* Forensic Investigations Table Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2.5">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>Querying local forensics database repository...</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <FolderGit2 className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">
              {searchQuery ? "No Matching Investigations Found" : "No Cases Ingested Yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? "Try searching by another keyword or reset active filters."
                : "Get started by creating your first verification case and uploading suspect media."}
            </p>
            {!searchQuery && (
              <div className="pt-2">
                <Link
                  to="/cases/new"
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Case</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center" scope="col">
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.size === filteredCases.length && filteredCases.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 w-36" scope="col">Identifier</th>
                  <th className="py-3 px-4" scope="col">Subject & Context</th>
                  <th className="py-3 px-4 w-36" scope="col">Evidence Items</th>
                  <th className="py-3 px-4 w-36" scope="col">Status</th>
                  <th className="py-3 px-4 w-36" scope="col">Registered</th>
                  <th className="py-3 px-4 w-28 text-right" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCases.map((c) => {
                  const isSelected = selectedCaseIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center" onClick={(e) => toggleSelectCase(c.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FolderOpen className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="truncate max-w-[120px]" title={c.id}>{c.id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {c.title}
                          </span>
                          {c.description && (
                            <span className="text-xs text-slate-500 truncate mt-0.5 max-w-xl">
                              {c.description}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                          <Layers className="h-3.5 w-3.5 text-slate-500" />
                          <span>{c.evidence_count} item{c.evidence_count !== 1 ? "s" : ""}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            c.status === "completed"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : c.status === "running"
                              ? "bg-blue-50 text-blue-800 border border-blue-200 animate-pulse"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {c.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                          <span className="uppercase text-[11px] font-mono">{c.status}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/cases/${c.id}`}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
                            title="Inspect Case"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(c.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Permanently Delete Case"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredCases.length} of {cases.length} investigation record(s)</span>
          <span className="font-mono text-[11px]">Storage: Local SQLite Encrypted Vault</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && selectedCaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Permanently Delete Investigation?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This action will permanently delete <strong className="text-slate-900">"{selectedCaseToDelete.title}"</strong> ({selectedCaseToDelete.id}), including all ingested evidence files, observation records, contradiction graph nodes, and audit logs.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Permanent Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
