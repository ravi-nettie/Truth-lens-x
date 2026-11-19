import React, { useRef, useState } from "react";
import { AlertCircle, Volume2 } from "lucide-react";

export interface WaveformBucket {
  min: number;
  max: number;
}

export interface DiscontinuityMarker {
  id?: string;
  time_start_ms: number;
  time_end_ms?: number | null;
  summary?: string;
  evidence_strength?: string;
  indicator?: string;
}

interface WaveformProps {
  buckets: WaveformBucket[];
  durationMs: number;
  discontinuities?: DiscontinuityMarker[];
  currentTimeMs: number;
  onSeek: (targetMs: number) => void;
  height?: number;
  className?: string;
  onMarkerClick?: (marker: DiscontinuityMarker) => void;
}

export const Waveform: React.FC<WaveformProps> = ({
  buckets,
  durationMs,
  discontinuities = [],
  currentTimeMs,
  onSeek,
  height = 120,
  className = "",
  onMarkerClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Fallback synthetic envelope if buckets are empty but duration is known
  const displayBuckets =
    buckets.length > 0
      ? buckets
      : Array.from({ length: 120 }, (_, i) => {
          const v = Math.sin(i * 0.15) * 0.4 + Math.cos(i * 0.3) * 0.3;
          return { min: -Math.abs(v), max: Math.abs(v) };
        });

  const effectiveDuration = durationMs > 0 ? durationMs : 15000;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const ms = Math.round(ratio * effectiveDuration);
    setHoverMs(ms);
    setHoverX(x);
  };

  const handlePointerLeave = () => {
    setHoverMs(null);
    setHoverX(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const targetMs = Math.round(ratio * effectiveDuration);
    onSeek(targetMs);
  };

  const formatTime = (ms: number) => {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, "0")}`;
  };

  const playheadRatio = Math.max(0, Math.min(currentTimeMs / effectiveDuration, 1));

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {/* Time & Cursor Info Header */}
      <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-on-surface">Interactive Waveform Envelope</span>
          <span className="text-on-surface-variant/70">| Click to Seek</span>
        </div>
        <div className="flex items-center gap-3">
          {hoverMs !== null && (
            <span className="text-primary bg-[#EFF6FF] px-2 py-0.5 rounded border border-blue-200">
              Hover: {formatTime(hoverMs)}
            </span>
          )}
          <span className="text-on-surface font-semibold">
            {formatTime(currentTimeMs)} / {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Waveform Canvas / SVG Container */}
      <div
        ref={containerRef}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ height: `${height}px` }}
        className="relative w-full rounded border border-outline-variant bg-surface-container-low p-1 cursor-pointer overflow-hidden group shadow-sm"
      >
        {/* Center line */}
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-outline-variant pointer-events-none" />

        {/* SVG Waveform Bars */}
        <svg
          viewBox={`0 0 ${displayBuckets.length} 100`}
          preserveAspectRatio="none"
          className="w-full h-full pointer-events-none"
        >
          <defs>
            <linearGradient id="waveGradientStitch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#64748B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="wavePlayedGradientStitch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#2563EB" stopOpacity="1" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {displayBuckets.map((b, i) => {
            const barRatio = i / displayBuckets.length;
            const isPlayed = barRatio <= playheadRatio;

            // Normalized height around center 50
            const amplitude = Math.max(0.06, Math.max(Math.abs(b.min), Math.abs(b.max)));
            const barHeight = Math.min(94, amplitude * 88);
            const y = 50 - barHeight / 2;

            return (
              <rect
                key={i}
                x={i}
                y={y}
                width={0.8}
                height={barHeight}
                rx={0.3}
                fill={isPlayed ? "url(#wavePlayedGradientStitch)" : "url(#waveGradientStitch)"}
              />
            );
          })}
        </svg>

        {/* Vertical Discontinuity Markers */}
        {discontinuities.map((marker, idx) => {
          const markerRatio = Math.max(0, Math.min(marker.time_start_ms / effectiveDuration, 1));
          const leftPct = `${markerRatio * 100}%`;
          const isModerateOrStrong =
            marker.evidence_strength === "moderate" || marker.evidence_strength === "strong";

          return (
            <div
              key={marker.id || idx}
              style={{ left: leftPct }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(marker.time_start_ms);
                if (onMarkerClick) onMarkerClick(marker);
              }}
              title={`Discontinuity at ${formatTime(marker.time_start_ms)}: ${marker.summary || "Phase / Flux Anomaly"}`}
              className="absolute top-0 bottom-0 w-[2px] z-20 cursor-pointer group/marker"
            >
              {/* Marker line */}
              <div
                className={`h-full w-full ${
                  isModerateOrStrong ? "bg-[#D97706]" : "bg-primary"
                }`}
              />
              {/* Top Pin Badge */}
              <div
                className={`absolute -top-1 -left-2.5 flex items-center justify-center h-5 w-5 rounded-full border shadow-sm transition-transform group-hover/marker:scale-125 ${
                  isModerateOrStrong
                    ? "bg-[#FFF5E6] text-[#D97706] border-amber-300"
                    : "bg-[#EFF6FF] text-primary border-blue-300"
                }`}
              >
                <AlertCircle className="h-3 w-3 stroke-[2.5]" />
              </div>
            </div>
          );
        })}

        {/* Playhead Scrub Line */}
        <div
          style={{ left: `${playheadRatio * 100}%` }}
          className="absolute top-0 bottom-0 w-[2px] bg-primary z-30 pointer-events-none shadow-sm"
        >
          <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-blue-200" />
        </div>

        {/* Hover Scrub Line */}
        {hoverX !== null && (
          <div
            style={{ left: `${hoverX}px` }}
            className="absolute top-0 bottom-0 w-[1px] bg-primary/60 border-l border-dashed border-primary z-10 pointer-events-none"
          />
        )}
      </div>

      {/* Discontinuity Marker Legend Bar */}
      {discontinuities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="font-semibold text-on-surface-variant text-[10px] uppercase font-mono">
            Discontinuities:
          </span>
          {discontinuities.map((d, i) => (
            <button
              key={d.id || i}
              type="button"
              onClick={() => onSeek(d.time_start_ms)}
              className="inline-flex items-center gap-1 rounded bg-[#FFF5E6] border border-amber-200 px-2 py-0.5 text-[10px] font-mono font-medium text-[#D97706] hover:bg-amber-100 transition-colors shadow-sm"
            >
              <AlertCircle className="h-3 w-3 text-[#D97706]" />
              <span>{formatTime(d.time_start_ms)}</span>
              <span className="text-[#D97706]/80 capitalize">({d.evidence_strength || "anomaly"})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Waveform;
