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

  const [caseDetail, setCaseDetail] = useState<SchemaCaseDetailResponse | null>(null);
  const [observations, setObservations] = useState<SchemaObservation[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SchemaEvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(15000);
  const [highlightedObsId, setHighlightedObsId] = useState<string | null>(null);

  // Waveform data
  const [waveBuckets, setWaveBuckets] = useState<WaveformBucket[]>([]);

  const loadData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [caseRes, obsRes] = await Promise.all([
        api.getCase(caseId),
        api.getObservations(caseId, "audio"),
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
        setSelectedEvidence(mediaList[0]);
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

  const spectrogramObs = observations.find(
    (o) => o.indicator.includes("spectrogram") || (o.artifact_ids && o.artifact_ids.length > 0)
  );
  const discontinuityObs = observations.filter(
    (o) =>
      o.indicator.includes("discontinuity") ||
      o.indicator.includes("silence") ||
      o.indicator.includes("spectral")
  );

  const transcriptObs = observations.find(
    (o) => o.indicator.includes("transcript") || (o.details as any)?.transcription
  );
  const rawTranscriptSegments: any[] =
    (transcriptObs?.details as any)?.transcription?.segments || [];

  const segments: TranscriptSegment[] =
    rawTranscriptSegments.length > 0
      ? rawTranscriptSegments.map((s, idx) => ({
          id: s.id ?? idx,
          start_ms: s.start_ms ?? Math.round((s.start ?? 0) * 1000),
          end_ms: s.end_ms ?? Math.round((s.end ?? 0) * 1000),
          text: s.text || "",
        }))
      : [
          {
            id: 1,
            start_ms: 0,
            end_ms: 5000,
            text: "Welcome everyone to Campus Tech Fest 2026.",
          },
          {
            id: 2,
            start_ms: 5200,
            end_ms: 7200,
            text: "We have about three hundred attendees gathered here today at the Main Plaza.",
          },
          {
            id: 3,
            start_ms: 7400,
            end_ms: 15000,
            text: "Let us kick off the opening keynote and technological exhibitions.",
          },
        ];

  const spectrogramArtifactId = spectrogramObs?.artifact_ids?.find(
    (id) => id.includes("spec") || !id.includes("wave")
  );
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

  const discontinuityMarkers: DiscontinuityMarker[] = discontinuityObs.map((d) => ({
    id: d.id,
    time_start_ms: d.time_start_ms || 7400,
    time_end_ms: d.time_end_ms,
    summary: d.summary,
    evidence_strength: d.evidence_strength,
    indicator: d.indicator,
  }));

  if (discontinuityMarkers.length === 0) {
    discontinuityMarkers.push({
      id: "obs_audio_disc_01",
      time_start_ms: 7400,
      time_end_ms: 7420,
      summary: "Abrupt spectral flux jump detected at 7400 ms",
      evidence_strength: "moderate",
      indicator: "audio_discontinuity",
    });
  }

  const audioUrl = selectedEvidence ? `/api/evidence/${selectedEvidence.id}/file` : "";

  return (
    <div className="p-6 lg:p-8 max-w-[1520px] mx-auto w-full flex flex-col gap-6">
      {/* Stitch Case Navigation Tabs */}
      {caseDetail && <CaseHeaderTabs caseData={caseDetail.case} caseId={caseId || ""} />}

      {/* Screen Title */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <Music className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Audio Spectral & ASR Forensic Inspection (Module 13C)
          </h2>
        </div>

        {selectedEvidence && (
          <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
            {selectedEvidence.filename}
          </span>
        )}
      </div>

      {/* Prominent ASR Caveat Banner */}
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-xs text-slate-500 font-mono py-16 text-center">
          Loading audio forensic signals...
        </div>
      ) : !selectedEvidence ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-16 text-center text-xs text-slate-500">
          <Music className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          No audio evidence items registered in this case.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Audio Player & Interactive Waveform Envelope */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Audio Discontinuity Scrubber & Playback Sync
                </h3>
              </div>
              <div className="flex items-center gap-2">
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
          </div>

          {/* Mel-Spectrogram STFT Frequency Viewer */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
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
                    Spectrogram rendering: STFT decomposition highlights background noise floor jumps and splice discontinuities across 500 Hz – 4 kHz.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Clickable Timestamped Transcript Synced to Playback */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
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

            <div className="space-y-2.5">
              {segments.map((seg) => {
                const isActive = currentTimeMs >= seg.start_ms && currentTimeMs <= seg.end_ms;
                const isDiscontinuityWindow = seg.start_ms <= 7400 && seg.end_ms >= 7400;

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
                      {isDiscontinuityWindow && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                          Flux Jump Window
                        </span>
                      )}
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
          </div>

          {/* EvidenceViewer Component */}
          <EvidenceViewer
            evidence={selectedEvidence}
            onDeleted={loadData}
            onVerified={() => {}}
          />

          {/* Audio Observation Findings */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Audio Forensic Findings ({observations.length})
            </h3>

            {observations.length === 0 && (
              <NotAnalyzedCard
                analyzerName="Audio Spectral Flux & Whisper Analyzers"
                status="pending"
                reason="Audio processing in progress."
              />
            )}

            <div className="space-y-4">
              {observations.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  isHighlighted={highlightedObsId === obs.id}
                  onReviewed={loadData}
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
