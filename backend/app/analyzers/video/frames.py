"""backend/app/analyzers/video/frames.py

Forensic Keyframe and Scene Cut Frame Extraction for TruthLens X.
Extracts representative visual keyframes at regular 1 fps intervals and at scene transitions.
Adheres strictly to Rule 3:
- Artifacts written strictly to ctx.artifact_dir
- SHA-256 computed and tracked for every extracted frame
- Pure functional design, no DB access, no unhandled exceptions
"""

import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import cv2
from PIL import Image


MAX_EXTRACTED_FRAMES = 25


def extract_representative_frames(
    evidence_id: str,
    case_id: str,
    video_path: Path,
    artifact_dir: Path,
    scene_cuts: Optional[List[Dict[str, Any]]] = None,
    max_duration_sec: float = 300.0,
    max_frames: int = MAX_EXTRACTED_FRAMES
) -> List[Dict[str, Any]]:
    """
    Extracts representative visual frame artifacts from video:
    - 1 frame per 2-5 seconds (sampled evenly across duration)
    - Frames at identified scene cuts
    """
    artifacts: List[Dict[str, Any]] = []
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return artifacts

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_ms = int((total_frames / fps) * 1000) if fps > 0 else 0
        effective_duration_ms = min(duration_ms, int(max_duration_sec * 1000))

        # Collect target timestamps (in milliseconds)
        target_timestamps: List[Tuple[int, str]] = []

        # 1. Target timestamps from scene cuts
        if scene_cuts:
            for cut in scene_cuts[:8]:
                ts = cut.get("time_end_ms", 0)
                if ts <= effective_duration_ms:
                    target_timestamps.append((ts, "scene_cut"))

        # 2. Regular interval samples
        # E.g. every 2-5 seconds depending on duration
        step_ms = max(2000, effective_duration_ms // 12) if effective_duration_ms > 0 else 2000
        curr_ts = 500  # Start slightly in
        while curr_ts <= effective_duration_ms and len(target_timestamps) < max_frames:
            target_timestamps.append((curr_ts, "sampled_keyframe"))
            curr_ts += step_ms

        # Sort by timestamp and remove duplicates within 500ms
        target_timestamps.sort(key=lambda x: x[0])
        deduped: List[Tuple[int, str]] = []
        last_t = -1000
        for t, kind in target_timestamps:
            if t - last_t >= 500:
                deduped.append((t, kind))
                last_t = t
                if len(deduped) >= max_frames:
                    break

        # Extract frames
        frame_idx = 0
        for ts_ms, kind in deduped:
            cap.set(cv2.CAP_PROP_POS_MSEC, ts_ms)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            frame_idx += 1
            artifact_id = f"art_frame_{uuid4().hex[:8]}"
            artifact_filename = f"frame_{evidence_id}_{frame_idx:03d}_{ts_ms}ms.jpg"
            artifact_path = artifact_dir / artifact_filename

            # Save JPEG with high quality
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb_frame)
            pil_img.save(artifact_path, format="JPEG", quality=90)

            with open(artifact_path, "rb") as f:
                art_sha256 = hashlib.sha256(f.read()).hexdigest()

            artifacts.append({
                "id": artifact_id,
                "case_id": case_id,
                "kind": "video_frame",
                "path": str(artifact_path),
                "sha256": art_sha256,
                "description": f"Extracted video frame at {round(ts_ms / 1000.0, 2)}s ({kind})",
                "media_time_ms": ts_ms
            })

    except Exception:
        pass
    finally:
        cap.release()

    return artifacts
