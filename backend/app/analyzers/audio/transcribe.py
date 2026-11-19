"""backend/app/analyzers/audio/transcribe.py

Local CPU speech transcription for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- CPU-only, 100% offline
- Never downloads models on request; records status="skipped_missing_model" if missing
- Supports fallback precomputed or user-supplied transcript
- Always includes mandatory ASR limitation disclaimer
- Saves transcript artifact (kind="transcript_json") strictly to ctx.artifact_dir
- Pure functional design, no DB access, no unhandled exceptions
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Claim, Modality, Observation, Strength
from backend.app.config import settings


ASR_LIMITATION = (
    "Whisper can mishear numbers, proper names, and accents; "
    "treat transcript-based findings as hypotheses to verify by listening."
)


def transcribe_audio(
    evidence_id: str,
    case_id: str,
    wav_path: Optional[Path],
    artifact_dir: Path,
    evidence_meta: Optional[Dict[str, Any]] = None,
    config: Optional[Dict[str, Any]] = None
) -> Tuple[str, List[Observation], List[Claim], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Transcribes audio using faster-whisper (if model on disk) or ingests fallback transcript.
    Returns:
    - transcription_status: "done", "skipped_missing_model", or "no_audio"
    - observations
    - claims
    - artifacts
    - details
    """
    observations: List[Observation] = []
    claims: List[Claim] = []
    artifacts: List[Dict[str, Any]] = []
    details: Dict[str, Any] = {
        "transcription_status": "skipped_missing_model",
        "source": None,
        "segments_count": 0,
        "full_text": "",
        "speech_rate_wpm": 0.0,
    }

    evidence_meta = evidence_meta or {}
    config = config or {}

    # 1. Check for fallback user-supplied or precomputed transcript
    fallback_text = (
        evidence_meta.get("transcript") or
        config.get("transcript") or
        evidence_meta.get("precomputed_transcript")
    )

    if fallback_text:
        source_label = "user-supplied" if "user" in str(evidence_meta.get("source_note", "")).lower() else "precomputed"
        details["transcription_status"] = "done"
        details["source"] = source_label
        details["full_text"] = fallback_text

        # Generate single or multi-segment transcript
        segment_id = f"seg_{uuid4().hex[:6]}"
        transcript_data = {
            "evidence_id": evidence_id,
            "source": source_label,
            "text": fallback_text,
            "segments": [
                {
                    "id": segment_id,
                    "start_ms": 0,
                    "end_ms": None,
                    "text": fallback_text
                }
            ],
            "limitations": ASR_LIMITATION
        }

        # Save artifact
        art_id = f"art_transcript_{uuid4().hex[:8]}"
        art_path = artifact_dir / f"transcript_{evidence_id}.json"
        with open(art_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2)

        with open(art_path, "rb") as f:
            art_sha256 = hashlib.sha256(f.read()).hexdigest()

        artifacts.append({
            "id": art_id,
            "case_id": case_id,
            "kind": "transcript_json",
            "path": str(art_path),
            "sha256": art_sha256,
            "description": f"Audio transcript ({source_label})"
        })

        # Emit Claim
        claims.append(
            Claim(
                id=f"claim_transcript_{uuid4().hex[:8]}",
                case_id=case_id,
                source_evidence_id=evidence_id,
                source_kind="transcript",
                text=fallback_text,
                claim_type="statement",
                value={"full_text": fallback_text, "source": source_label},
                time_start_ms=0,
                time_end_ms=None
            )
        )

        return "done", observations, claims, artifacts, details

    # 2. Check if wav_path exists
    if not wav_path or not wav_path.exists():
        details["transcription_status"] = "no_audio"
        return "no_audio", observations, claims, artifacts, details

    # 3. Check for Whisper Model on Disk (Rule 1: Never download on request)
    model_name = config.get("whisper_model", settings.WHISPER_MODEL)
    models_dir = Path(settings.MODELS_DIR).resolve()
    model_disk_path = models_dir / model_name

    # Check common layout: directory with model.bin or model directory
    model_found = model_disk_path.exists() and (
        (model_disk_path / "model.bin").exists() or
        (model_disk_path / "config.json").exists()
    )

    if not model_found:
        details["transcription_status"] = "skipped_missing_model"
        details["error"] = (
            f"Pretrained Whisper model '{model_name}' not found locally at '{model_disk_path}'. "
            f"In accordance with Rule 1, models are not downloaded at runtime. "
            f"Run 'python scripts/download_models.py' during setup."
        )

        observations.append(
            Observation(
                id=f"obs_whisper_skipped_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.audio,
                indicator="speech_transcription_skipped",
                method="faster_whisper_asr",
                summary=f"Speech transcription skipped: model '{model_name}' missing locally",
                explanation=details["error"],
                alternative_explanation="Whisper model has not been pre-downloaded to the local machine.",
                evidence_strength=Strength.informational,
                limitations=ASR_LIMITATION,
                details={"model_name": model_name, "status": "skipped_missing_model"}
            )
        )
        return "skipped_missing_model", observations, claims, artifacts, details

    # 4. Attempt Local Faster-Whisper Inference
    try:
        from faster_whisper import WhisperModel

        compute_type = config.get("whisper_compute_type", settings.WHISPER_COMPUTE_TYPE)
        model = WhisperModel(
            str(model_disk_path),
            device="cpu",
            compute_type=compute_type,
            local_files_only=True
        )

        segments_iter, info = model.transcribe(
            str(wav_path),
            beam_size=1,
            word_timestamps=True
        )

        segments_list = []
        full_text_parts = []

        for seg in segments_iter:
            s_start = int(round(seg.start * 1000.0))
            s_end = int(round(seg.end * 1000.0))
            s_text = seg.text.strip()
            full_text_parts.append(s_text)

            seg_dict = {
                "id": f"seg_{len(segments_list):04d}",
                "start_ms": s_start,
                "end_ms": s_end,
                "text": s_text,
                "words": []
            }
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    seg_dict["words"].append({
                        "word": w.word.strip(),
                        "start_ms": int(round(w.start * 1000.0)),
                        "end_ms": int(round(w.end * 1000.0)),
                        "probability": round(float(w.probability), 3)
                    })
            segments_list.append(seg_dict)

            # Emit claim per segment
            claims.append(
                Claim(
                    id=f"claim_whisper_{uuid4().hex[:8]}",
                    case_id=case_id,
                    source_evidence_id=evidence_id,
                    source_kind="transcript",
                    text=s_text,
                    claim_type="statement",
                    value={"segment_id": seg_dict["id"], "text": s_text},
                    time_start_ms=s_start,
                    time_end_ms=s_end
                )
            )

        full_text = " ".join(full_text_parts)
        details["transcription_status"] = "done"
        details["source"] = "faster-whisper-local"
        details["segments_count"] = len(segments_list)
        details["full_text"] = full_text

        # Compute speech-rate WPM
        total_duration_sec = info.duration if hasattr(info, "duration") else 0.0
        word_count = len(full_text.split())
        if total_duration_sec > 0:
            details["speech_rate_wpm"] = round((word_count / total_duration_sec) * 60.0, 1)

        # Save transcript artifact
        transcript_data = {
            "evidence_id": evidence_id,
            "source": "faster-whisper-local",
            "model": model_name,
            "duration_sec": total_duration_sec,
            "language": getattr(info, "language", "en"),
            "full_text": full_text,
            "segments": segments_list,
            "limitations": ASR_LIMITATION
        }

        art_id = f"art_transcript_{uuid4().hex[:8]}"
        art_path = artifact_dir / f"transcript_{evidence_id}.json"
        with open(art_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, indent=2)

        with open(art_path, "rb") as f:
            art_sha256 = hashlib.sha256(f.read()).hexdigest()

        artifacts.append({
            "id": art_id,
            "case_id": case_id,
            "kind": "transcript_json",
            "path": str(art_path),
            "sha256": art_sha256,
            "description": f"ASR Speech transcript ({model_name}, local CPU)"
        })

        return "done", observations, claims, artifacts, details

    except Exception as e:
        details["transcription_status"] = "skipped_missing_model"
        details["error"] = f"Whisper inference error: {str(e)}"
        observations.append(
            Observation(
                id=f"obs_whisper_error_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.audio,
                indicator="speech_transcription_error",
                method="faster_whisper_asr",
                summary="Speech transcription failed during model execution",
                explanation=f"Whisper inference error: {str(e)}",
                alternative_explanation="Audio format incompatible with ASR decoder or insufficient system memory.",
                evidence_strength=Strength.informational,
                limitations=ASR_LIMITATION,
                details={"error": str(e)}
            )
        )
        return "skipped_missing_model", observations, claims, artifacts, details

