"""backend/app/analyzers/audio/run.py

Pure-function audio analyzer orchestrator for TruthLens X (Module 13C).
Adheres strictly to Rule 1, Rule 2, Rule 3, and Rule 4:
- Signature: def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult
- CPU-only, 100% offline, local-first
- Pure function: no DB access, no modification of original files
- Never raises unhandled exceptions (returns status="failed" with human-readable error)
- Safe subprocess calls for FFmpeg / ffprobe
- Cleans up temporary extracted WAV files after run
- Aggregates stream extraction, waveform/spectrogram, acoustic discontinuity, and transcription
"""

import os
from pathlib import Path
from typing import Any, Dict, List

from shared.schemas import AnalysisContext, AnalyzerResult, Claim, Observation
from backend.app.analyzers.audio.extract import extract_audio_wav
from backend.app.analyzers.audio.spectrogram import generate_waveform_and_spectrogram
from backend.app.analyzers.audio.discontinuity import analyze_audio_discontinuities
from backend.app.analyzers.audio.transcribe import transcribe_audio


def analyze(evidence: Dict[str, Any], ctx: AnalysisContext) -> AnalyzerResult:
    """
    Forensic audio analyzer orchestrating extraction, spectrogram generation,
    spectral discontinuity detection, and speech transcription.
    """
    evidence_id = evidence.get("id", "unknown_evidence")
    case_id = ctx.case_id
    stored_path_str = evidence.get("stored_path")

    if not stored_path_str or not os.path.exists(stored_path_str):
        return AnalyzerResult(
            status="failed",
            error=f"Evidence audio file not found at path: {stored_path_str}",
            tool_version="1.0.0"
        )

    input_path = Path(stored_path_str)
    work_dir = Path(ctx.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir = Path(ctx.artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    all_observations: List[Observation] = []
    all_claims: List[Claim] = []
    all_artifacts: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {
        "modality": "audio",
    }

    temp_wav_path = None

    try:
        # 1. Extract temporary mono 16 kHz WAV
        temp_wav_path, extract_obs, extract_meta = extract_audio_wav(
            evidence_id,
            case_id,
            input_path,
            work_dir
        )
        all_observations.extend(extract_obs)
        metadata.update(extract_meta)

        # If container has no audio stream, finish cleanly with informational report
        if not temp_wav_path or not temp_wav_path.exists():
            return AnalyzerResult(
                status="done",
                observations=all_observations,
                claims=all_claims,
                artifacts=all_artifacts,
                metadata=metadata,
                tool_version="1.0.0"
            )

        # 2. Waveform Envelope JSON & Spectrogram PNG Artifacts
        spec_artifacts, spec_telemetry = generate_waveform_and_spectrogram(
            evidence_id,
            case_id,
            temp_wav_path,
            artifact_dir
        )
        all_artifacts.extend(spec_artifacts)
        metadata["spectrogram"] = spec_telemetry

        # 3. Spectral Flux & Acoustic Discontinuity Detection
        disc_obs, disc_telemetry = analyze_audio_discontinuities(
            evidence_id,
            case_id,
            temp_wav_path
        )
        all_observations.extend(disc_obs)
        metadata["discontinuity"] = disc_telemetry

        # 4. Speech Transcription (faster-whisper or fallback)
        tr_status, tr_obs, tr_claims, tr_artifacts, tr_details = transcribe_audio(
            evidence_id,
            case_id,
            temp_wav_path,
            artifact_dir,
            evidence_meta=evidence,
            config=ctx.config
        )
        all_observations.extend(tr_obs)
        all_claims.extend(tr_claims)
        all_artifacts.extend(tr_artifacts)
        metadata["transcription"] = tr_details

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
            error=f"Audio analyzer error: {str(e)}",
            tool_version="1.0.0"
        )
    finally:
        # Clean up temporary WAV file
        if temp_wav_path and temp_wav_path.exists():
            try:
                temp_wav_path.unlink(missing_ok=True)
            except Exception:
                pass
