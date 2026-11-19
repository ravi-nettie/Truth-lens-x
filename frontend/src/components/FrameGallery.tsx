import React, { useState } from "react";
import {
  Film,
  Maximize2,
  X,
  Play,
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
      <div className={`rounded border border-dashed border-outline-variant bg-surface-container-low p-8 text-center text-xs text-on-surface-variant ${className}`}>
        <Film className="h-6 w-6 text-on-surface-variant/60 mx-auto mb-2" />
        No candidate sampled frames flagged in this video stream.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Sampled & Co-Flagged Video Frames ({frames.length})
          </h4>
        </div>
        <span className="text-[11px] font-mono text-on-surface-variant">
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
              className={`group relative rounded border transition-all cursor-pointer overflow-hidden bg-white flex flex-col justify-between shadow-sm ${
                isHighSuspicion
                  ? "border-amber-400 hover:border-amber-500 hover:ring-2 hover:ring-amber-200"
                  : "border-outline-variant hover:border-primary/40 hover:shadow"
              }`}
            >
              {/* Image Preview / Placeholder */}
              <div className="relative aspect-video w-full bg-surface-container-low flex items-center justify-center overflow-hidden border-b border-outline-variant/60">
                {frameImg ? (
                  <img
                    src={frameImg}
                    alt={`Frame at ${formatPts(frame.pts_time_ms)}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Film className="h-6 w-6 text-on-surface-variant/40 group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-mono text-on-surface-variant mt-1">
                      {frame.frame_index ? `Frame #${frame.frame_index}` : "Candidate Cut"}
                    </span>
                  </div>
                )}

                {/* Co-Flagged Count Badge */}
                {frame.co_flagged_count > 1 && (
                  <span className="absolute top-1.5 right-1.5 rounded-full bg-[#D97706] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                    {frame.co_flagged_count} Indicators
                  </span>
                )}

                {/* Hover overlay icon */}
                <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Maximize2 className="h-4 w-4 text-white" />
                </div>
              </div>

              {/* Timestamp & Info Bar */}
              <div className="p-2.5 space-y-1 bg-white">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-on-surface">PTS {formatPts(frame.pts_time_ms)}</span>
                  {frame.frame_index && (
                    <span className="text-on-surface-variant text-[10px]">#{frame.frame_index}</span>
                  )}
                </div>

                {/* Indicators Pill List */}
                <div className="flex flex-wrap gap-1">
                  {frame.indicators.map((ind, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono rounded bg-surface-container-low border border-outline-variant px-1.5 py-0.5 text-on-surface-variant truncate max-w-[120px]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-lg border border-outline-variant bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <span>Frame Lightbox: PTS {formatPts(selectedLightboxFrame.pts_time_ms)}</span>
                  {selectedLightboxFrame.frame_index && (
                    <span className="font-mono text-xs text-on-surface-variant">
                      (Frame #{selectedLightboxFrame.frame_index})
                    </span>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLightboxFrame(null)}
                className="rounded p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Large Image Preview */}
            <div className="relative aspect-video w-full rounded bg-black border border-outline-variant flex items-center justify-center overflow-hidden">
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
                  <Film className="h-12 w-12 text-slate-500 mx-auto" />
                  <p className="text-xs font-mono text-slate-400">
                    Candidate cut point at PTS {formatPts(selectedLightboxFrame.pts_time_ms)}
                  </p>
                </div>
              )}
            </div>

            {/* Frame Metadata & Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1.5 rounded border border-outline-variant bg-surface-container-low p-3">
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                  Flagged Forensic Indicators ({selectedLightboxFrame.indicators.length})
                </span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedLightboxFrame.indicators.map((ind, i) => (
                    <span
                      key={i}
                      className="rounded bg-[#EFF6FF] border border-blue-200 px-2 py-0.5 text-primary text-[10px]"
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-outline-variant bg-surface-container-low p-3 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                    Anomaly Context
                  </span>
                  <p className="text-on-surface text-[11px] mt-1 font-sans">
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
                    className="flex items-center justify-center gap-1.5 w-full bg-primary hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded text-xs transition-colors mt-2 shadow-sm"
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
