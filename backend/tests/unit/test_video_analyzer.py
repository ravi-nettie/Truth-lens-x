"""backend/tests/unit/test_video_analyzer.py

Unit tests for TruthLens X Video Forensics (Module 13B).
Tests:
- Clean video container and stream inspection (probe & frame extraction)
- Scene cut detection (Rule 2: strictly informational)
- Video creation timestamp metadata claim emission
- Corrupt/missing file error handling (Rule 3: no unhandled exceptions)
"""

import tempfile
import shutil
from pathlib import Path
import pytest

from shared.schemas import AnalysisContext, Strength
from backend.app.services.safe_subprocess import run_ffmpeg
from backend.app.analyzers.video.run import analyze


@pytest.fixture
def test_dirs():
    work_dir = Path(tempfile.mkdtemp())
    art_dir = Path(tempfile.mkdtemp())
    yield work_dir, art_dir
    shutil.rmtree(work_dir, ignore_errors=True)
    shutil.rmtree(art_dir, ignore_errors=True)


def test_clean_video_analysis(test_dirs):
    work_dir, art_dir = test_dirs
    vid_path = work_dir / "clean.mp4"

    # Generate 2 second synthetic testsrc video
    res = run_ffmpeg([
        "-f", "lavfi",
        "-i", "testsrc=duration=2:size=320x240:rate=25",
        "-c:v", "libx264",
        "-y", str(vid_path)
    ])
    assert res.returncode == 0

    ctx = AnalysisContext(case_id="case_vid_clean", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_vid_clean", "stored_path": str(vid_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.error is None
    assert result.metadata["duration_sec"] >= 1.9
    assert result.metadata["video_codec"] == "h264"
    assert result.metadata["width"] == 320
    assert result.metadata["height"] == 240

    # Keyframe artifacts extracted
    frame_arts = [a for a in result.artifacts if a["kind"] == "video_frame"]
    assert len(frame_arts) >= 1
    assert Path(frame_arts[0]["path"]).exists()


def test_video_scene_cut_detection(test_dirs):
    work_dir, art_dir = test_dirs
    vid_path = work_dir / "scenecut.mp4"

    # Concatenate 1s red and 1s blue frames for a hard cut
    res = run_ffmpeg([
        "-f", "lavfi", "-i", "color=c=red:duration=1:size=320x240:rate=25",
        "-f", "lavfi", "-i", "color=c=blue:duration=1:size=320x240:rate=25",
        "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]",
        "-map", "[v]",
        "-c:v", "libx264",
        "-y", str(vid_path)
    ])
    assert res.returncode == 0

    ctx = AnalysisContext(case_id="case_scenecut", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_scenecut", "stored_path": str(vid_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    cut_obs = next((o for o in result.observations if o.indicator == "video_scene_cut"), None)
    assert cut_obs is not None

    # Rule 2: Ordinary video scene cut MUST be informational
    assert cut_obs.evidence_strength == Strength.informational
    assert cut_obs.time_start_ms is not None
    assert cut_obs.time_end_ms is not None
    assert cut_obs.time_end_ms >= cut_obs.time_start_ms


def test_video_metadata_claim_extraction(test_dirs):
    work_dir, art_dir = test_dirs
    vid_path = work_dir / "tagged.mp4"

    # Embed creation_time metadata tag
    res = run_ffmpeg([
        "-f", "lavfi",
        "-i", "testsrc=duration=1:size=160x120:rate=20",
        "-metadata", "creation_time=2024-06-15T10:30:00Z",
        "-c:v", "libx264",
        "-y", str(vid_path)
    ])
    assert res.returncode == 0

    ctx = AnalysisContext(case_id="case_tagged", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_tagged", "stored_path": str(vid_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    time_claim = next((c for c in result.claims if c.source_kind == "metadata" and c.claim_type == "datetime"), None)
    assert time_claim is not None
    assert "2024" in time_claim.text
    assert time_claim.value.get("creation_time") is not None


def test_corrupt_or_missing_video(test_dirs):
    work_dir, art_dir = test_dirs
    missing_path = work_dir / "nonexistent.mp4"

    ctx = AnalysisContext(case_id="case_missing", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_missing", "stored_path": str(missing_path)}

    result = analyze(evidence, ctx)

    # Rule 3: Never raise unhandled exception
    assert result.status == "failed"
    assert result.error is not None

