import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderGit2,
  ArrowRight,
  Trash2,
  AlertTriangle,
  Layers,
  Calendar,
  PlusCircle,
  Clock,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { api, SchemaCaseResponse } from "../api/client";

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<SchemaCaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="h-6 w-6 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Forensic Case History</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse local verification cases, inspect cryptographic audit trails, and manage evidence archives.
          </p>
        </div>
        <Link
          to="/cases/new"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create New Case</span>
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>Loading case archive from SQLite database...</span>
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center space-y-3">
          <FolderGit2 className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Cases Ingested Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by creating your first verification case and uploading suspect media.
          </p>
          <Link
            to="/cases/new"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create First Case</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 hover:bg-slate-900/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-400 uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {c.id}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800/60">
                    {c.status}
                  </span>
                </div>

                <Link
                  to={`/cases/${c.id}`}
                  className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors block"
                >
                  {c.title}
                </Link>

                {c.description && (
                  <p className="text-xs text-slate-400 line-clamp-1 max-w-3xl">
                    {c.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-600" />
                    <span>Created: {new Date(c.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3 text-slate-600" />
                    <span>{c.evidence_count} evidence item(s)</span>
                  </span>
                </div>
              </div>

              {/* Actions: Open and Delete */}
              <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                <Link
                  to={`/cases/${c.id}`}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors border border-slate-700"
                >
                  <span>Open Case</span>
                  <ArrowRight className="h-3.5 w-3.5 text-indigo-400" />
                </Link>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(c.id)}
                  title="Permanently Delete Case"
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors border border-transparent hover:border-rose-900/60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && selectedCaseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/80 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Permanently Delete Case?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action will permanently delete <strong className="text-white">"{selectedCaseToDelete.title}"</strong> ({selectedCaseToDelete.id}), including all ingested evidence files, observations, correlation graphs, and audit history.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
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
