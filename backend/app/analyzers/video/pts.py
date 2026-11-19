"""backend/app/analyzers/video/pts.py

Forensic Video Presentation Timestamp (PTS/DTS) and Frame Pacing Analysis.
Adheres strictly to Rule 2 and Rule 4:
- All ffprobe calls pass through safe_subprocess
- PTS anomalies flagged as informational or weak with mandatory plain-language alternative explanations
- Pure functional design, no DB access, no unhandled exceptions
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Modality, Observation, Strength
from backend.app.services.safe_subprocess import run_ffprobe


def analyze_pts(
    evidence_id: str,
    case_id: str,
    video_path: Path,
    read_interval_sec: int = 30
) -> Tuple[List[Observation], Dict[str, Any]]:
    """
    Inspects video frame presentation timestamps for dropped frames, PTS reordering gaps,
    or irregular pacing anomalies.
    """
    observations: List[Observation] = []
    stats: Dict[str, Any] = {
        "frames_inspected": 0,
        "anomalous_gaps": 0,
        "max_pts_gap_ms": 0,
        "has_pts_jitter": False,
    }

    cmd_args = [
        "-v", "quiet",
        "-print_format", "json",
        "-show_frames",
        "-select_streams", "v",
        "-show_entries", "frame=pkt_pts_time,pkt_dts_time,key_frame,pict_type",
        "-read_intervals", f"%+{read_interval_sec}",
        str(video_path)
    ]

    try:
        res = run_ffprobe(cmd_args, timeout_sec=25.0)
        if res.returncode != 0:
            stats["error"] = "ffprobe failed to inspect frame timestamps"
            return observations, stats

        data = json.loads(res.stdout)
        frames = data.get("frames", [])
        stats["frames_inspected"] = len(frames)

        if len(frames) < 10:
            return observations, stats

        pts_list: List[float] = []
        for f in frames:
            pts_time = f.get("pkt_pts_time")
            if pts_time is not None:
                try:
                    pts_list.append(float(pts_time))
                except (ValueError, TypeError):
                    continue

        if len(pts_list) < 5:
            return observations, stats

        # Calculate consecutive PTS deltas
        deltas = [pts_list[i] - pts_list[i - 1] for i in range(1, len(pts_list))]
        # Positive deltas
        valid_deltas = [d for d in deltas if d > 0.001]
        if not valid_deltas:
            return observations, stats

        median_delta = sorted(valid_deltas)[len(valid_deltas) // 2]
        expected_fps = round(1.0 / median_delta, 1) if median_delta > 0 else 30.0

        anomalies = []
        max_gap = 0.0

        for i, d in enumerate(deltas):
            if d > max_gap:
                max_gap = d
            # Flag gaps exceeding 3.5x expected frame delta (and > 100ms)
            if d > max(0.12, median_delta * 3.5):
                start_ms = int(pts_list[i] * 1000)
                end_ms = int(pts_list[i + 1] * 1000)
                anomalies.append({
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "gap_sec": round(d, 3),
                    "frame_index": i + 1
                })

        stats["max_pts_gap_ms"] = int(max_gap * 1000)
        stats["anomalous_gaps"] = len(anomalies)

        if anomalies:
            stats["has_pts_jitter"] = True
            primary_anomaly = anomalies[0]
            observations.append(
                Observation(
                    id=f"obs_pts_gap_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.video,
                    indicator="pts_timestamp_gap",
                    method="frame_pts_continuity_analysis",
                    summary=f"Frame presentation timestamp gap detected ({primary_anomaly['gap_sec']}s at {round(primary_anomaly['start_ms'] / 1000.0, 2)}s)",
                    explanation=(
                        f"Analysis of packet presentation timestamps (PTS) identified {len(anomalies)} temporal discontinuity gaps. "
                        f"The largest gap spans {primary_anomaly['gap_sec']}s starting at {round(primary_anomaly['start_ms'] / 1000.0, 2)}s."
                    ),
                    alternative_explanation=(
                        "Live streaming packet dropouts, capture buffer underruns, variable frame rate encoding, "
                        "or operating system scheduling delays during screen or webcam capture."
                    ),
                    evidence_strength=Strength.weak,
                    time_start_ms=primary_anomaly["start_ms"],
                    time_end_ms=primary_anomaly["end_ms"],
                    limitations=(
                        "PTS gaps reflect transmission or capture frame pacing irregularities, but cannot distinguish "
                        "between intentional frame deletion (splicing) and benign stream jitter."
                    ),
                    details={"anomalies": anomalies[:5], "expected_fps": expected_fps, "median_delta_sec": round(median_delta, 4)}
                )
            )

    except Exception as e:
        stats["error"] = str(e)

    return observations, stats

