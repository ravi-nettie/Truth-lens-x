"""backend/app/analyzers/video/run.py

Pure-function video analyzer orchestrator for TruthLens X (Module 13B).
Adheres strictly to Rule 1, Rule 2, Rule 3, and Rule 4:
- Signature: def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult
- CPU-only, 100% offline, local-first
- Pure function: no DB access, no modification of original files
- Never raises unhandled exceptions (returns status="failed" with human-readable error)
- Safe subprocess calls for FFmpeg / ffprobe
- Aggregates stream probe, scene cut detection, PTS continuity, and keyframe extraction
"""

import os
from pathlib import Path
from typing import Any, Dict, List

from shared.schemas import AnalysisContext, AnalyzerResult, Claim, Observation
from backend.app.analyzers.video.probe import MAX_VIDEO_DURATION_SEC, probe_video
from backend.app.analyzers.video.scenecut import detect_scene_cuts
from backend.app.analyzers.video.pts import analyze_pts
from backend.app.analyzers.video.frames import extract_representative_frames


def analyze(evidence: Dict[str, Any], ctx: AnalysisContext) -> AnalyzerResult:
    """
    Forensic video analyzer executing container probe, scene cuts, PTS continuity, and frame extraction.
    """
    evidence_id = evidence.get("id", "unknown_evidence")
    case_id = ctx.case_id
    stored_path_str = evidence.get("stored_path")

    if not stored_path_str or not os.path.exists(stored_path_str):
        return AnalyzerResult(
            status="failed",
            error=f"Evidence video file not found at path: {stored_path_str}",
            tool_version="1.0.0"
        )

    video_path = Path(stored_path_str)
    artifact_dir = Path(ctx.artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    all_observations: List[Observation] = []
    all_claims: List[Claim] = []
    all_artifacts: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {
        "modality": "video",
    }

    try:
        # 1. Container & Stream Probe (safe ffprobe)
        probe_obs, probe_claims, probe_meta = probe_video(evidence_id, case_id, video_path)
        all_observations.extend(probe_obs)
        all_claims.extend(probe_claims)
        metadata.update(probe_meta)

        # 2. Scene Cut Detection (OpenCV HSV correlation)
        scene_obs, scene_cuts, scene_stats = detect_scene_cuts(
            evidence_id,
            case_id,
            video_path,
            max_duration_sec=MAX_VIDEO_DURATION_SEC
        )
        all_observations.extend(scene_obs)
        metadata["scene_cuts"] = scene_stats

        # 3. PTS Timestamp Continuity Check (safe ffprobe)
        pts_obs, pts_stats = analyze_pts(
            evidence_id,
            case_id,
            video_path,
            read_interval_sec=30
        )
        all_observations.extend(pts_obs)
        metadata["pts"] = pts_stats

        # 4. Keyframe & Shot Boundary Extraction
        frame_artifacts = extract_representative_frames(
            evidence_id,
            case_id,
            video_path,
            artifact_dir,
            scene_cuts=scene_cuts,
            max_duration_sec=MAX_VIDEO_DURATION_SEC
        )
        all_artifacts.extend(frame_artifacts)
        metadata["extracted_frames_count"] = len(frame_artifacts)

        return AnalyzerResult(
            status="done",
            observations=all_observations,
            claims=all_claims,
            artifacts=all_artifacts,
            metadata=metadata,
            tool_version="1.0.0"
        )

    except Exception as e:
        return AnalyzerResult(
            status="failed",
            error=f"Video analyzer error: {str(e)}",
            tool_version="1.0.0"
        )
