"""backend/app/analyzers/audio/extract.py

Audio stream extraction service for TruthLens X.
Adheres strictly to Rule 2, Rule 3, and Rule 4:
- Uses safe_subprocess with mandatory FFmpeg security flags
- Extracts temporary mono 16 kHz WAV (-vn -ac 1 -ar 16000)
- Enforces MAX_AUDIO_DURATION_SEC (default 300s)
- If media has no audio track, returns informational observation (never fails or raises)
- Provides clean temporary WAV lifecycle management
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Modality, Observation, Strength
from backend.app.services.safe_subprocess import run_ffmpeg, run_ffprobe


MAX_AUDIO_DURATION_SEC = 300.0


def has_audio_stream(file_path: Path) -> bool:
    """Checks whether the media container contains at least one audio stream."""
    cmd = [
        "-v", "quiet",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "csv=p=0",
        str(file_path)
    ]
    try:
        res = run_ffprobe(cmd, timeout_sec=15.0)
        return "audio" in res.stdout.lower()
    except Exception:
        return False


def extract_audio_wav(
    evidence_id: str,
    case_id: str,
    input_path: Path,
    work_dir: Path,
    max_duration_sec: float = MAX_AUDIO_DURATION_SEC
) -> Tuple[Optional[Path], List[Observation], Dict[str, Any]]:
    """
    Extracts a normalized mono 16 kHz WAV file from the media file.
    Returns:
    - Path to temp WAV file (or None if no audio track exists)
    - List of observations (e.g. no audio stream, duration capped)
    - Telemetry dict
    """
    observations: List[Observation] = []
    telemetry: Dict[str, Any] = {
        "has_audio": True,
        "sample_rate": 16000,
        "channels": 1,
        "duration_capped": False,
    }

    if not input_path.exists():
        telemetry["has_audio"] = False
        return None, observations, telemetry

    # Check for audio stream presence
    if not has_audio_stream(input_path):
        telemetry["has_audio"] = False
        observations.append(
            Observation(
                id=f"obs_no_audio_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.audio,
                indicator="no_audio_stream",
                method="container_stream_probe",
                summary="No audio stream present in media container",
                explanation="The uploaded media container does not contain an audio track.",
                alternative_explanation="Video or media file was recorded without audio capture or muted during export.",
                evidence_strength=Strength.informational,
                limitations="Audio forensics cannot be performed on media containers without an audio stream.",
                details={"input_file": input_path.name}
            )
        )
        return None, observations, telemetry

    # Create temporary WAV path in work_dir
    temp_wav_path = work_dir / f"extracted_{evidence_id}_{uuid4().hex[:6]}.wav"

    cmd = [
        "-i", str(input_path),
        "-t", str(max_duration_sec),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-y",
        str(temp_wav_path)
    ]

    try:
        res = run_ffmpeg(cmd, timeout_sec=60.0, max_duration_sec=max_duration_sec)
        if res.returncode != 0 or not temp_wav_path.exists() or temp_wav_path.stat().st_size == 0:
            telemetry["has_audio"] = False
            telemetry["ffmpeg_error"] = res.stderr[:300]
            return None, observations, telemetry

        return temp_wav_path, observations, telemetry

    except Exception as e:
        telemetry["has_audio"] = False
        telemetry["error"] = str(e)
        return None, observations, telemetry

