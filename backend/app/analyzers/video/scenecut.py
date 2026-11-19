"""backend/app/analyzers/video/scenecut.py

Forensic Video Scene Cut and Shot Boundary Detection.
Adheres strictly to Rule 2:
- Ordinary video scene cuts alone MUST be informational, never suspicious by themselves
- Emits Observation with indicator="video_scene_cut" and exact millisecond bounds
- Pure functional design, no DB access, no unhandled exceptions
"""

from pathlib import Path
from typing import Any, Dict, List, Tuple
from uuid import uuid4

import cv2
import numpy as np

from shared.schemas import Modality, Observation, Strength


def detect_scene_cuts(
    evidence_id: str,
    case_id: str,
    video_path: Path,
    max_duration_sec: float = 300.0,
    corr_threshold: float = 0.45
) -> Tuple[List[Observation], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Detects scene transitions using HSV histogram correlation between consecutive sampled frames.
    All detected scene cuts are reported as strictly informational.
    """
    observations: List[Observation] = []
    cuts_data: List[Dict[str, Any]] = []
    stats: Dict[str, Any] = {
        "frames_evaluated": 0,
        "cuts_detected": 0,
        "sample_interval_ms": 200,
    }

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        stats["error"] = "Failed to open video container with OpenCV"
        return observations, cuts_data, stats

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if fps <= 0:
            fps = 30.0

        prev_hist = None
        prev_ms = 0

        # Sample every 5 frames (~150-200ms at 25-30fps) for fast CPU-bound detection
        sample_step = max(1, int(round(fps / 5.0)))
        frame_idx = 0

        while True:
            ret = cap.grab()
            if not ret:
                break

            if frame_idx % sample_step == 0:
                ret_frame, frame = cap.retrieve()
                if not ret_frame or frame is None:
                    break

                curr_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))
                if curr_ms > max_duration_sec * 1000:
                    break

                # Downscale for rapid HSV histogram comparison
                small = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_NEAREST)
                hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [16, 16], [0, 180, 0, 256])
                cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)

                if prev_hist is not None:
                    # Compare histograms using correlation
                    corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)

                    # When correlation drops sharply below threshold, shot cut detected
                    if corr < corr_threshold:
                        cut_info = {
                            "time_start_ms": prev_ms,
                            "time_end_ms": curr_ms,
                            "correlation": round(float(corr), 3),
                            "frame_index": frame_idx
                        }
                        cuts_data.append(cut_info)

                        observations.append(
                            Observation(
                                id=f"obs_scenecut_{uuid4().hex[:8]}",
                                case_id=case_id,
                                evidence_id=evidence_id,
                                modality=Modality.video,
                                indicator="video_scene_cut",
                                method="hsv_histogram_correlation",
                                summary=f"Scene cut detected at {round(curr_ms / 1000.0, 2)}s",
                                explanation=(
                                    f"Visual shot boundary detected between {round(prev_ms / 1000.0, 2)}s and "
                                    f"{round(curr_ms / 1000.0, 2)}s (histogram correlation {round(float(corr), 3)})."
                                ),
                                alternative_explanation=(
                                    "Standard cinematic or editorial cut produced during normal camera pauses, "
                                    "multi-camera switching, or benign video assembly."
                                ),
                                evidence_strength=Strength.informational,
                                time_start_ms=prev_ms,
                                time_end_ms=curr_ms,
                                limitations=(
                                    "Scene cuts are ubiquitous in authentic edited video and broadcast content. "
                                    "Shot boundaries alone never indicate deceptive manipulation."
                                ),
                                details=cut_info
                            )
                        )

                prev_hist = hist
                prev_ms = curr_ms
                stats["frames_evaluated"] += 1

            frame_idx += 1

        stats["cuts_detected"] = len(cuts_data)

    except Exception as e:
        stats["error"] = str(e)
    finally:
        cap.release()

    return observations, cuts_data, stats

