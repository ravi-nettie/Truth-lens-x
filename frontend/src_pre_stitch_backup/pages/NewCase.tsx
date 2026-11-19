import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileCheck2,
  Lock,
  MessageSquare,
  Play,
  AlertCircle,
  Plus,
  Loader2,
  Trash2,
  File,
  Film,
  Image as ImageIcon,
  Music,
  Info,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api/client";

interface PendingFile {
  file: File;
  sourceNote: string;
  modality: "image" | "video" | "audio" | "other";
}

export const NewCase: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Case Metadata
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Files Queue
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Caption / Claim
  const [captionText, setCaptionText] = useState("");
  const [captionSource, setCaptionSource] = useState("social_post");

  // Execution states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentProgressStep, setCurrentProgressStep] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine modality from file
  const detectModality = (file: File): "image" | "video" | "audio" | "other" => {
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp|tiff)$/.test(name)) return "image";
    if (mime.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/.test(name)) return "video";
    if (mime.startsWith("audio/") || /\.(wav|mp3|m4a|aac|ogg|flac)$/.test(name)) return "audio";
    return "other";
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    setErrorMsg(null);
    const newItems: PendingFile[] = [];

    Array.from(fileList).forEach((file) => {
      // 200 MB limit check (200 * 1024 * 1024 = 209715200 bytes)
      if (file.size > 200 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds the 200 MB size limit.`);
        return;
      }
      newItems.push({
        file,
        sourceNote: "",
        modality: detectModality(file),
      });
    });

    setPendingFiles((prev) => [...prev, ...newItems]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSourceNote = (index: number, note: string) => {
    setPendingFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, sourceNote: note } : item))
    );
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Format file size
  const formatBytes = (bytes: number) => {
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Main submission: Ingest case + files + claims, then Start Analysis
  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please provide a title for the case.");
      return;
    }
    if (pendingFiles.length === 0 && !captionText.trim()) {
      setErrorMsg("Please provide at least one evidence media file or context claim text.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. Create Case
      setCurrentProgressStep("Initializing verification case in database...");
      const caseRes = await api.createCase({
        title: title.trim(),
        description: notes.trim(),
        notes: notes.trim(),
      });
      const caseId = caseRes.id;

      // 2. Upload Evidence Files sequentially into read-only store
      for (let i = 0; i < pendingFiles.length; i++) {
        const item = pendingFiles[i];
        setCurrentProgressStep(
          `Ingesting file ${i + 1}/${pendingFiles.length}: "${item.file.name}" (SHA-256 + mode 0444)...`
        );
        await api.uploadEvidence(caseId, item.file, item.sourceNote);
      }

      // 3. Ingest Caption / Claim if present
      if (captionText.trim()) {
        setCurrentProgressStep("Ingesting stated narrative claims into evidence repository...");
        await api.addCaption(caseId, captionText.trim(), captionSource);
      }

      // 4. Trigger Analysis
      setCurrentProgressStep("Dispatching pipeline analyzers to background queue...");
      await api.triggerAnalysis(caseId, false);

      // Navigate to Dashboard
      navigate(`/cases/${caseId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize case or ingest evidence.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <h1 className="text-2xl font-black text-white">Create Verification Case</h1>
        </div>
        <p className="text-xs text-slate-400">
          Ingest media into the tamper-evident read-only repository (mode 0444) and trigger rule-based forensic analysis.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleStartAnalysis} className="space-y-6">
        {/* Section 1: Case Details */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
              1
            </span>
            <span>Case Identification & Context</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Case Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Campus Tech Fest Attendance Claim Verification"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Context & Provenance Notes (Optional)
              </label>
              <textarea
                placeholder="Originating URL, claimed event timestamp, source credibility notes, or investigative context..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Multi-File Evidence Upload */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                2
              </span>
              <span>Evidence Files (Images, Videos, Audio)</span>
            </h2>

            {/* Compliance Limits Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-slate-300">
                Limit: 200 MB per file
              </span>
              <span className="rounded bg-indigo-950/70 border border-indigo-800 px-2 py-0.5 text-indigo-300">
                Video Demo Cap: 5 Minutes
              </span>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-950/20"
                : "border-slate-800 bg-slate-950 hover:border-slate-700"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.wav,.mp3,.m4a"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
              disabled={isSubmitting}
              className="hidden"
            />
            <UploadCloud className="h-10 w-10 text-indigo-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-white">
              Drag & drop media files here, or click to browse
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports JPEG, PNG, WebP images · MP4, MOV, WebM videos · WAV, MP3, M4A audio
            </p>
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              Enforces 200 MB maximum file size & 5-minute video duration cap for CPU processing.
            </p>
          </div>

          {/* Pending Files List */}
          {pendingFiles.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Selected Evidence Queue ({pendingFiles.length})
              </span>
              <div className="space-y-2">
                {pendingFiles.map((item, idx) => {
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {item.modality === "image" ? (
                          <ImageIcon className="h-5 w-5 text-indigo-400 shrink-0" />
                        ) : item.modality === "video" ? (
                          <Film className="h-5 w-5 text-sky-400 shrink-0" />
                        ) : item.modality === "audio" ? (
                          <Music className="h-5 w-5 text-emerald-400 shrink-0" />
                        ) : (
                          <File className="h-5 w-5 text-slate-400 shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{item.file.name}</span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 uppercase">
                              {item.modality}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {formatBytes(item.file.size)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          placeholder="Source note (e.g. stage left phone)..."
                          value={item.sourceNote}
                          onChange={(e) => updateSourceNote(idx, e.target.value)}
                          disabled={isSubmitting}
                          className="flex-1 sm:w-48 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          disabled={isSubmitting}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Caption & Context Claim Input */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
              3
            </span>
            <span>Social Media Caption & Narrative Claims</span>
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Post Text or Public Claim
              </label>
              <textarea
                placeholder="e.g. Record turnout: 3,000 attendees gathered at Main Plaza for Tech Fest 2026!"
                rows={2}
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Claim Source:</span>
              <select
                value={captionSource}
                onChange={(e) => setCaptionSource(e.target.value)}
                disabled={isSubmitting}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1 focus:outline-none"
              >
                <option value="social_post">Social Media Post</option>
                <option value="alt_text">Alt Text / Description</option>
                <option value="press_release">Press Release</option>
                <option value="user_input">User Provided Context</option>
              </select>
            </div>
          </div>
        </section>

        {/* Action Button: Start Analysis */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400 font-mono">
            {isSubmitting && currentProgressStep && (
              <span className="flex items-center gap-2 text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{currentProgressStep}</span>
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (pendingFiles.length === 0 && !captionText.trim())}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            <span>Start Analysis</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewCase;
