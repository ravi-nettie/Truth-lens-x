import React, { useState } from "react";
import {
  Film,
  Maximize2,
  X,
  Play,
  Layers,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export interface VideoFrameItem {
  id: string;
  frame_index?: number | null;
  pts_time_ms: number;
  image_url?: string;
  artifact_id?: string;
  indicators: string[];
  co_flagged_count: number;
  summary?: string;
  evidence_strength?: string;
}

interface FrameGalleryProps {
  frames: VideoFrameItem[];
  onSeek?: (pts_time_ms: number) => void;
  className?: string;
}

export const FrameGallery: React.FC<FrameGalleryProps> = ({
  frames,
  onSeek,
  className = "",
}) => {
  const [selectedLightboxFrame, setSelectedLightboxFrame] = useState<VideoFrameItem | null>(null);

  // Sort frames by co_flagged_count descending
  const sortedFrames = [...frames].sort((a, b) => b.co_flagged_count - a.co_flagged_count);

  const formatPts = (ms: number) => {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, "0")}`;
  };

  if (frames.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-500 ${className}`}>
        <Film className="h-6 w-6 text-slate-600 mx-auto mb-2" />
        No candidate sampled frames flagged in this video stream.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Sampled & Co-Flagged Video Frames ({frames.length})
          </h4>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Sorted by Co-Flagged Anomaly Count
        </span>
      </div>

      {/* Frame Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sortedFrames.map((frame) => {
          const isHighSuspicion = frame.co_flagged_count > 1;
          const frameImg = frame.image_url || (frame.artifact_id ? `/api/artifacts/${frame.artifact_id}` : null);

          return (
            <div
              key={frame.id}
              onClick={() => setSelectedLightboxFrame(frame)}
              className={`group relative rounded-lg border transition-all cursor-pointer overflow-hidden bg-slate-950 flex flex-col justify-between ${
                isHighSuspicion
                  ? "border-amber-600/70 hover:border-amber-500 hover:ring-2 hover:ring-amber-500/40"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Image Preview / Placeholder */}
              <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                {frameImg ? (
                  <img
                    src={frameImg}
                    alt={`Frame at ${formatPts(frame.pts_time_ms)}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Film className="h-6 w-6 text-slate-700 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-[10px] font-mono text-slate-500 mt-1">
                      {frame.frame_index ? `Frame #${frame.frame_index}` : "Candidate Cut"}
                    </span>
                  </div>
                )}

                {/* Co-Flagged Count Badge */}
                {frame.co_flagged_count > 1 && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 shadow">
                    {frame.co_flagged_count} Indicators
                  </span>
                )}

                {/* Hover overlay icon */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Timestamp & Info Bar */}
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-white">PTS {formatPts(frame.pts_time_ms)}</span>
                  {frame.frame_index && (
                    <span className="text-slate-500 text-[10px]">#{frame.frame_index}</span>
                  )}
                </div>

                {/* Indicators Pill List */}
                <div className="flex flex-wrap gap-1">
                  {frame.indicators.map((ind, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono rounded bg-slate-900 border border-slate-800 px-1 py-0.2 text-slate-400 truncate max-w-[120px]"
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clickable Lightbox Modal */}
      {selectedLightboxFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Film className="h-4 w-4 text-indigo-400" />
                  <span>Frame Lightbox: PTS {formatPts(selectedLightboxFrame.pts_time_ms)}</span>
                  {selectedLightboxFrame.frame_index && (
                    <span className="font-mono text-xs text-slate-400">
                      (Frame #{selectedLightboxFrame.frame_index})
                    </span>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLightboxFrame(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Large Image Preview */}
            <div className="relative aspect-video w-full rounded-xl bg-black border border-slate-800 flex items-center justify-center overflow-hidden">
              {selectedLightboxFrame.image_url || selectedLightboxFrame.artifact_id ? (
                <img
                  src={
                    selectedLightboxFrame.image_url ||
                    `/api/artifacts/${selectedLightboxFrame.artifact_id}`
                  }
                  alt="Candidate Frame"
                  className="max-h-[440px] w-full object-contain"
                />
              ) : (
                <div className="text-center p-8 space-y-2">
                  <Film className="h-12 w-12 text-slate-700 mx-auto" />
                  <p className="text-xs font-mono text-slate-400">
                    Candidate cut point at PTS {formatPts(selectedLightboxFrame.pts_time_ms)}
                  </p>
                </div>
              )}
            </div>

            {/* Frame Metadata & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Flagged Forensic Indicators ({selectedLightboxFrame.indicators.length})
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedLightboxFrame.indicators.map((ind, i) => (
                    <span
                      key={i}
                      className="rounded bg-indigo-950/70 border border-indigo-800 px-2 py-0.5 text-indigo-300 text-[10px]"
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Anomaly Context
                  </span>
                  <p className="text-slate-300 text-[11px] mt-1 font-sans">
                    {selectedLightboxFrame.summary ||
                      "Identified candidate cut / PTS boundary during automated video analysis."}
                  </p>
                </div>

                {onSeek && (
                  <button
                    type="button"
                    onClick={() => {
                      onSeek(selectedLightboxFrame.pts_time_ms);
                      setSelectedLightboxFrame(null);
                    }}
                    className="flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors mt-2"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" />
                    <span>Seek Player to This Frame</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrameGallery;
