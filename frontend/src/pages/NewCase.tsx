import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileCheck2,
  Lock,
  Play,
  AlertCircle,
  Plus,
  Loader2,
  Trash2,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Info,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Copy,
  Layers,
  Fingerprint,
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
  const [leadInvestigator, setLeadInvestigator] = useState("A. Vance (Forensic Unit 4 - Biometrics)");
  const [priority, setPriority] = useState<"routine" | "expedited" | "critical">("expedited");

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
      // 200 MB limit check
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
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Main submission: Ingest case + files + claims, then Start Analysis
  const handleStartAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      const fullNotes = [
        notes.trim(),
        `Lead Investigator: ${leadInvestigator}`,
        `Priority: ${priority.toUpperCase()}`,
      ].filter(Boolean).join("\n");

      const caseRes = await api.createCase({
        title: title.trim(),
        description: fullNotes,
        notes: fullNotes,
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

  const totalBytes = pendingFiles.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Top Action Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight">
              New Investigation
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              INTAKE STAGE
            </span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Initialize forensic analysis by registering case parameters and uploading digital media assets with guaranteed cryptographic provenance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="h-9 px-4 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleStartAnalysis()}
            disabled={isSubmitting || (pendingFiles.length === 0 && !captionText.trim())}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            <span>{isSubmitting ? "Initializing Pipeline..." : "Start Analysis"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {isSubmitting && currentProgressStep && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 flex items-center gap-3 shadow-sm animate-pulse">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
          <span className="font-medium">{currentProgressStep}</span>
        </div>
      )}

      <form onSubmit={handleStartAnalysis} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Case Parameters & Analysis Pipelines (approx 58%) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Case Information Card */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">Case Information</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono font-medium">CHAIN-OF-CUSTODY V4.2</span>
            </div>

            {/* Case Title Input */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <label className="text-xs font-semibold text-slate-700 pt-2" htmlFor="case-title">
                Case Title / Subject <span className="text-red-500">*</span>
              </label>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <input
                  id="case-title"
                  type="text"
                  placeholder="e.g. Campus Tech Fest Attendance Claim Verification"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="w-full bg-white text-slate-900 text-sm px-3.5 py-2 rounded-lg border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
                <span className="text-xs text-slate-400">Clear descriptive summary for judicial dossier export.</span>
              </div>
            </div>

            {/* Description & Claimed Context */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <label className="text-xs font-semibold text-slate-700 pt-2" htmlFor="case-desc">
                Context & Provenance Notes
              </label>
              <div className="sm:col-span-2 flex flex-col gap-1">
                <textarea
                  id="case-desc"
                  rows={3}
                  placeholder="Describe alleged context, origin platform, claimed timestamp, and transmission vector..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-white text-slate-900 text-sm p-3 rounded-lg border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Lead Investigator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <label className="text-xs font-semibold text-slate-700" htmlFor="lead-investigator">
                Lead Investigator
              </label>
              <div className="sm:col-span-2 relative">
                <select
                  id="lead-investigator"
                  value={leadInvestigator}
                  onChange={(e) => setLeadInvestigator(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-white text-slate-900 text-sm px-3.5 py-2 rounded-lg border border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                >
                  <option>A. Vance (Forensic Unit 4 - Biometrics)</option>
                  <option>M. Reyes (Digital Media Extraction)</option>
                  <option>S. Zhang (Neural Synthesis & Deepfake Analysis)</option>
                  <option>K. Lindqvist (Hardware Cryptography & Vault)</option>
                </select>
              </div>
            </div>

            {/* Priority Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <label className="text-xs font-semibold text-slate-700 pt-1">
                Investigation Priority
              </label>
              <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority("routine")}
                  className={`p-2.5 rounded-lg border text-center transition-colors flex flex-col items-center justify-center ${
                    priority === "routine"
                      ? "bg-slate-100 border-slate-400 text-slate-900 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-medium">Routine</span>
                  <span className="text-[11px] text-slate-500">24-48 hrs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("expedited")}
                  className={`p-2.5 rounded-lg border text-center transition-colors flex flex-col items-center justify-center ${
                    priority === "expedited"
                      ? "bg-blue-50 border-blue-400 text-blue-900 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-semibold text-blue-700">Expedited</span>
                  <span className="text-[11px] text-slate-500">4-8 hrs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("critical")}
                  className={`p-2.5 rounded-lg border text-center transition-colors flex flex-col items-center justify-center ${
                    priority === "critical"
                      ? "bg-red-50 border-red-400 text-red-900 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-semibold text-red-700">Critical Review</span>
                  <span className="text-[11px] text-slate-500">&lt; 1 hr</span>
                </button>
              </div>
            </div>
          </section>

          {/* Social Media Caption & Narrative Claims */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Social Media Caption & Narrative Claims
                </h2>
              </div>
              <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                NLP Modality
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Post Text or Stated Claim
                </label>
                <textarea
                  placeholder="e.g. Record turnout: 3,000 attendees gathered at Main Plaza for Tech Fest 2026!"
                  rows={2}
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">Claim Source:</span>
                <select
                  value={captionSource}
                  onChange={(e) => setCaptionSource(e.target.value)}
                  disabled={isSubmitting}
                  className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="social_post">Social Media Post</option>
                  <option value="alt_text">Alt Text / Description</option>
                  <option value="press_release">Press Release</option>
                  <option value="user_input">User Provided Context</option>
                </select>
              </div>
            </div>
          </section>

          {/* Analysis Pipeline Configuration Notice */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">Analysis Pipelines (Automated)</h2>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                4 Active Engines
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 flex items-center justify-between mb-1">
                  <span>Image Forensics</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">ELA + Copy-Move</span>
                </div>
                <p className="text-slate-500 text-[11px]">Error Level Analysis, clone block matching, quantization tables, and EXIF consistency.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 flex items-center justify-between mb-1">
                  <span>Video Forensics</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">PTS + Scene Cuts</span>
                </div>
                <p className="text-slate-500 text-[11px]">Frame presentation timestamp jitter, hard cut detection, and container atom audits.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 flex items-center justify-between mb-1">
                  <span>Audio Forensics</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">FFT + ENF</span>
                </div>
                <p className="text-slate-500 text-[11px]">Spectral continuity, silence anomaly detection, and electric grid frequency cues.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800 flex items-center justify-between mb-1">
                  <span>Cross-Modal Correlation</span>
                  <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Rule Engine R1-R7</span>
                </div>
                <p className="text-slate-500 text-[11px]">Contradiction synthesis between audio-visual timing, stated claims, and EXIF timestamps.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Evidence Dropzone & Staged Queue (approx 42%) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Evidence Dropzone */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">Evidence Ingestion</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">MAX 200 MB / FILE</span>
            </div>

            {/* Drop Zone Box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-50/60"
                  : "border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-400"
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
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                Drag & Drop Digital Media Assets
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mb-3">
                Ingest raw audio, video, container images, or contextual caption transcripts from local storage.
              </p>
              <button
                type="button"
                className="h-8 px-4 bg-white text-blue-600 text-xs font-semibold rounded-md border border-slate-200 shadow-xs hover:bg-slate-50 transition-colors"
              >
                Browse Local Workstation
              </button>
            </div>

            {/* Cryptographic Ingestion Guarantee Banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-50/60 border border-blue-100 text-slate-700">
              <Fingerprint className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-slate-900">Cryptographic Ingestion Guarantee</span>
                <p className="text-slate-600 leading-relaxed">
                  All media payloads are hashed with <code className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200 text-slate-800">SHA-256</code> and sealed into read-only storage (mode <code className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200 text-slate-800">0444</code>).
                </p>
                <div className="flex flex-wrap gap-1 mt-1 font-mono text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">JPEG</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">PNG</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">MP4</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">MOV</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">WAV</span>
                  <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">MP3</span>
                </div>
              </div>
            </div>
          </section>

          {/* Staged Assets Queue */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Staged Evidence Queue ({pendingFiles.length})
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-mono font-medium">
                {formatBytes(totalBytes)} Total
              </span>
            </div>

            {pendingFiles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No evidence files added yet. Drop files above or browse to stage them for cryptographic sealing.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {pendingFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors flex flex-col gap-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
                          {item.modality === "image" ? (
                            <ImageIcon className="h-4 w-4 text-blue-600" />
                          ) : item.modality === "video" ? (
                            <Film className="h-4 w-4 text-sky-600" />
                          ) : item.modality === "audio" ? (
                            <Music className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate">{item.file.name}</span>
                          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                            <span>{formatBytes(item.file.size)}</span>
                            <span>•</span>
                            <span className="uppercase font-mono text-[10px]">{item.modality}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold">
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                          Staged
                        </span>
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          disabled={isSubmitting}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition-colors"
                          title="Remove asset"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Source note (e.g. stage left phone camera, WhatsApp forward)..."
                        value={item.sourceNote}
                        onChange={(e) => updateSourceNote(idx, e.target.value)}
                        disabled={isSubmitting}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-slate-500 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>{pendingFiles.length} file(s) queued for ingestion</span>
              </span>
              <span className="font-mono text-[11px]">Audit Engine Ready</span>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
};

export default NewCase;
