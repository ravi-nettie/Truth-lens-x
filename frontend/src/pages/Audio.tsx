import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Music,
  ArrowLeft,
  Volume2,
  AlertTriangle,
  Radio,
  FileAudio,
  Play,
  Pause,
  Clock,
  Sparkles,
  Info,
  Layers,
  CheckCircle2,
  UploadCloud,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  api,
  SchemaCaseDetailResponse,
  SchemaEvidenceResponse,
  SchemaObservation,
} from "../api/client";
import { CaseHeaderTabs } from "../components/CaseHeaderTabs";
import { ObservationCard } from "../components/ObservationCard";
import { NotAnalyzedCard } from "../components/NotAnalyzedCard";
import { EvidenceViewer } from "../components/EvidenceViewer";
import { Waveform, DiscontinuityMarker, WaveformBucket } from "../components/Waveform";

interface TranscriptSegment {
  id?: number | string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export const Audio: React.FC = () => {
  const { id: caseId } = useParams<{ id: string }>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SchemaEvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload & Analysis state
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadNote, setUploadNote] = useState("");

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(15000);
  const [highlightedObsId, setHighlightedObsId] = useState<string | null>(null);

  // Waveform data
  const [waveBuckets, setWaveBuckets] = useState<WaveformBucket[]>([]);

  const loadData = async (preserveEvidenceId?: string) => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, obsRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId, "audio").catch(() => []),
      ]);
      setCaseDetail(caseRes);
      setObservations(obsRes || []);

      const mediaList = (caseRes.evidence_items || []).filter(
        (e) =>
          e.modality === "audio" ||
          e.modality === "video" ||
          e.mime_type.startsWith("audio/") ||
          e.mime_type.startsWith("video/")
      );

      if (mediaList.length > 0) {
        if (preserveEvidenceId) {
          const match = mediaList.find((m) => m.id === preserveEvidenceId);
          setSelectedEvidence(match || mediaList[0]);
        } else if (!selectedEvidence || !mediaList.some((m) => m.id === selectedEvidence.id)) {
          setSelectedEvidence(mediaList[0]);
        }
      } else {
        setSelectedEvidence(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load audio forensic data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  // Handle direct audio upload (WAV, MP3, M4A)
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseId) return;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".wav", ".mp3", ".m4a"].includes(ext)) {
      setErrorMsg(`Unsupported audio format '${ext}'. Please upload a valid WAV, MP3, or M4A file.`);
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploadRes = await api.uploadEvidence(caseId, file, uploadNote || "Audio forensic intake");
      setSuccessMsg(`Successfully uploaded ${file.name}. Starting forensic analysis...`);

      // Automatically trigger analysis
      setIsAnalyzing(true);
      await api.triggerAnalysis(caseId);

      // Poll until analysis completes
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const st = await api.getCaseStatus(caseId);
          if (["analyzed", "correlated", "in_review", "reported", "done"].includes(st.status) || attempts > 20) {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            setSuccessMsg(`Analysis complete for ${file.name}.`);
            await loadData(uploadRes.evidence.id);
          }
        } catch {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          await loadData(uploadRes.evidence.id);
        }
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload and analyze audio file.");
      setIsAnalyzing(false);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Trigger manual analysis on existing case evidence
  const handleTriggerAnalysis = async () => {
    if (!caseId) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      await api.triggerAnalysis(caseId);
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const st = await api.getCaseStatus(caseId);
          if (["analyzed", "correlated", "in_review", "reported", "done"].includes(st.status) || attempts > 20) {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            await loadData(selectedEvidence?.id);
          }
        } catch {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          await loadData(selectedEvidence?.id);
        }
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger analysis.");
      setIsAnalyzing(false);
    }
  };

  const audioEvidenceList = (caseDetail?.evidence_items || []).filter(
    (e) =>
      e.modality === "audio" ||
      e.modality === "video" ||
      e.mime_type.startsWith("audio/") ||
      e.mime_type.startsWith("video/")
  );

  // Filter observations for current selected evidence
  const evidenceObservations = selectedEvidence
    ? observations.filter((o) => o.evidence_id === selectedEvidence.id)
    : observations;

  const spectrogramObs = evidenceObservations.find(
    (o) => o.indicator.includes("spectrogram") || (o.artifact_ids && o.artifact_ids.length > 0)
  );

  const discontinuityObs = evidenceObservations.filter(
    (o) =>
      o.indicator.includes("discontinuity") ||
      o.indicator.includes("silence") ||
      o.indicator.includes("spectral") ||
      o.indicator.includes("clipping") ||
      o.indicator.includes("noise_floor")
  );

  const transcriptObs = evidenceObservations.find(
    (o) =>
      o.indicator.includes("transcript") ||
      Boolean((o.details as any)?.transcription)
  );

  const rawTranscriptSegments: any[] =
    (transcriptObs?.details as any)?.transcription?.segments || [];

  // Authentic segments without fabrication
  const segments: TranscriptSegment[] =
    rawTranscriptSegments.length > 0
      ? rawTranscriptSegments.map((s, idx) => ({
          id: s.id ?? idx,
          start_ms: s.start_ms ?? Math.round((s.start ?? 0) * 1000),
          end_ms: s.end_ms ?? Math.round((s.end ?? 0) * 1000),
          text: s.text || "",
        }))
      : [];

  const spectrogramArtifactId = spectrogramObs?.artifact_ids?.find(
    (id) => id.includes("spec")
  ) || spectrogramObs?.artifact_ids?.find((id) => !id.includes("wave"));

  const spectrogramUrl = spectrogramArtifactId
    ? `/api/artifacts/${spectrogramArtifactId}`
    : "";

  const waveformArtifactId = spectrogramObs?.artifact_ids?.find((id) =>
    id.includes("wave")
  );

  useEffect(() => {
    if (waveformArtifactId) {
      fetch(`/api/artifacts/${waveformArtifactId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.buckets && Array.isArray(data.buckets)) {
            setWaveBuckets(data.buckets);
          }
          if (data.duration_ms) {
            setDurationMs(data.duration_ms);
          }
        })
        .catch(() => {});
    } else {
      setWaveBuckets([]);
    }
  }, [waveformArtifactId]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const ms = Math.round(audioRef.current.currentTime * 1000);
      setCurrentTimeMs(ms);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      const ms = Math.round(audioRef.current.duration * 1000);
      if (ms > 0) setDurationMs(ms);
    }
  };

  const seekToMs = (ms: number) => {
    setCurrentTimeMs(ms);
    if (audioRef.current) {
      audioRef.current.currentTime = ms / 1000.0;
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Strictly real discontinuity markers — zero fabricated fallbacks
  const discontinuityMarkers: DiscontinuityMarker[] = discontinuityObs.map((d) => ({
    id: d.id,
    time_start_ms: d.time_start_ms || 0,
    time_end_ms: d.time_end_ms,
    summary: d.summary,
    evidence_strength: d.evidence_strength,
    indicator: d.indicator,
  }));

  const audioUrl = selectedEvidence ? `/api/evidence/${selectedEvidence.id}/file` : "";

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title & Evidence Selector */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs">
            <Music className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Audio Forensics & ASR Transcription (Module 13C)
            </h2>
            <p className="text-xs text-slate-500">
              Deterministic spectral flux discontinuities, noise floor envelope shifts, and local Whisper speech decoding.
            </p>
          </div>
        </div>

        {/* Evidence Switcher & Upload Button */}
        <div className="flex flex-wrap items-center gap-2">
          {audioEvidenceList.length > 1 && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="px-2 font-mono text-slate-500">Track:</span>
              <select
                value={selectedEvidence?.id || ""}
                onChange={(e) => {
                  const item = audioEvidenceList.find((m) => m.id === e.target.value);
                  if (item) setSelectedEvidence(item);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-1 font-mono text-xs text-slate-700 font-medium focus:outline-hidden"
              >
                {audioEvidenceList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.filename} ({item.modality.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAudioUpload}
            accept=".wav,.mp3,.m4a"
            className="hidden"
          />

          <button
            type="button"
            disabled={isUploading || isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            <span>{isUploading ? "Uploading..." : "Upload Audio (WAV / MP3 / M4A)"}</span>
          </button>

          {caseDetail && caseDetail.case.status !== "analyzed" && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleTriggerAnalysis}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2 rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-white" />
              )}
              <span>{isAnalyzing ? "Analyzing..." : "Run Analysis"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Prominent ASR Forensic Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-amber-900 font-bold uppercase tracking-wider text-[11px]">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Automated Speech Recognition (ASR) Forensic Caveat</span>
        </div>
        <p className="text-amber-800 leading-relaxed">
          ASR transcription is generated locally via quantized <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-amber-900">faster-whisper (int8 CPU)</code>. Machine transcriptions frequently suffer from acoustic noise distortion, dialectal homophones, and colloquial approximations (e.g. <em>"three hundred"</em> vs. <em>"three thousand"</em>). ASR outputs are <strong className="text-amber-950 font-semibold">not ground-truth legal testimony</strong> without primary human acoustic verification.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-500 font-mono text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span>Loading audio forensic signals and acoustic spectrum...</span>
        </div>
      ) : !selectedEvidence ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center space-y-4">
          <FileAudio className="h-12 w-12 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">No Audio Evidence Uploaded</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Upload a recorded speech clip, broadcast audio stream, or extracted sound file (.wav, .mp3, .m4a) to inspect spectral discontinuities, noise floor envelopes, and automated speech transcripts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-lg text-xs shadow-xs transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Select Audio File</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Audio Player & Interactive Waveform Envelope */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Audio Discontinuity Scrubber & Playback Sync
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  {selectedEvidence.filename}
                </span>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition-colors"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                  <span>{isPlaying ? "Pause" : "Play Audio"}</span>
                </button>
              </div>
            </div>

            {/* Underlying HTML5 Audio Element */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-8"
              controls
            />

            {/* Custom Interactive Waveform Component */}
            <Waveform
              buckets={waveBuckets}
              durationMs={durationMs}
              discontinuities={discontinuityMarkers}
              currentTimeMs={currentTimeMs}
              onSeek={seekToMs}
              onMarkerClick={(marker) => setHighlightedObsId(marker.id || null)}
            />

            {/* Honest Discontinuity Status Indicator */}
            {discontinuityMarkers.length === 0 ? (
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Continuous Acoustic Signal: No spectral flux jumps, background noise floor shifts, or peak clipping anomalies detected.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{discontinuityMarkers.length} acoustic discontinuity marker(s) detected. Click markers on the waveform to inspect exact millisecond timestamps.</span>
              </div>
            )}
          </div>

          {/* Mel-Spectrogram STFT Frequency Viewer */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Short-Time Fourier Transform (STFT) Mel-Spectrogram
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                0 Hz – 8,000 Hz · Frequency Continuity Analysis
              </span>
            </div>

            <div className="relative rounded-lg border border-slate-200 bg-slate-900 p-3 text-center overflow-hidden">
              {spectrogramUrl ? (
                <img
                  src={spectrogramUrl}
                  alt="Mel-Spectrogram"
                  className="max-h-[380px] w-full object-contain rounded"
                />
              ) : (
                <div className="p-8 text-center space-y-2 bg-slate-50 rounded-md">
                  <Radio className="h-10 w-10 text-slate-400 mx-auto" />
                  <p className="text-xs font-mono text-slate-500">
                    Spectrogram pending analysis. Click "Run Analysis" to compute STFT decomposition and frequency power distribution.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Clickable Timestamped Transcript Synced to Playback */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Clickable Timestamped Speech Transcript (Whisper int8)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Click any line to seek audio playback
              </span>
            </div>

            {segments.length > 0 ? (
              <div className="space-y-2.5">
                {segments.map((seg) => {
                  const isActive = currentTimeMs >= seg.start_ms && currentTimeMs <= seg.end_ms;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => seekToMs(seg.start_ms)}
                      className={`rounded-lg p-3.5 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                        isActive
                          ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500 shadow-xs"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200 shrink-0 font-semibold">
                          {Math.floor(seg.start_ms / 1000)}s – {Math.floor(seg.end_ms / 1000)}s
                        </span>
                        <p
                          className={`text-xs leading-relaxed ${
                            isActive ? "text-blue-950 font-semibold" : "text-slate-700"
                          }`}
                        >
                          "{seg.text}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="text-xs font-mono text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium"
                        >
                          <Play className="h-3 w-3 fill-slate-500 hover:fill-blue-600" />
                          <span>Seek</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : transcriptObs?.indicator === "speech_transcription_skipped" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1">
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span>Speech Transcription Skipped</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {transcriptObs.explanation || "Whisper ASR model weights not found in local models directory. Run 'python scripts/download_models.py' during initial setup to enable offline speech-to-text."}
                </p>
              </div>
            ) : transcriptObs?.indicator === "speech_transcription_error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs space-y-1">
                <div className="font-semibold text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Speech Transcription Error</span>
                </div>
                <p className="text-red-700 leading-relaxed">
                  {transcriptObs.explanation || "An unexpected error occurred during speech decoding."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-1 text-xs text-slate-500">
                <FileText className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                <p className="font-medium text-slate-700">No Dialogue Detected or Transcription Not Performed</p>
                <p className="text-slate-500">Audio does not contain speech, or the analysis pipeline has not yet executed.</p>
              </div>
            )}
          </div>

          {/* EvidenceViewer Component */}
          <EvidenceViewer
            evidence={selectedEvidence}
            onDeleted={() => loadData()}
            onVerified={() => {}}
          />

          {/* Audio Observation Findings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Audio Forensic Findings ({evidenceObservations.length})
            </h3>

            {evidenceObservations.length === 0 && (
              <NotAnalyzedCard
                analyzerName="Audio Spectral Flux & Whisper Analyzers"
                status="pending"
                reason="Audio processing in progress or pending pipeline trigger."
              />
            )}

            <div className="space-y-4">
              {evidenceObservations.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  isHighlighted={highlightedObsId === obs.id}
                  onReviewed={() => loadData(selectedEvidence.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Audio;
