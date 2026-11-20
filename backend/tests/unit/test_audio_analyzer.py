"""backend/tests/unit/test_audio_analyzer.py

Unit tests for TruthLens X Audio Forensics (Module 13C).
Tests:
- Clean generated continuous WAV
- Spliced WAV with abrupt noise-floor + spectral change at 3.0s (must flag within +/- 0.3s)
- Silent WAV container
- Noisy continuous WAV container
- Media without audio stream (Rule 2: strictly informational)
"""

import tempfile
import shutil
from pathlib import Path
import wave
import pytest
import numpy as np

from shared.schemas import AnalysisContext, Strength
from backend.app.analyzers.audio.run import analyze


def write_test_wav(path: Path, samples: np.ndarray, sr: int = 16000) -> None:
    """Writes mono 16-bit PCM WAV using standard library wave module."""
    scaled = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(scaled.tobytes())


@pytest.fixture
def test_dirs():
    work_dir = Path(tempfile.mkdtemp())
    art_dir = Path(tempfile.mkdtemp())
    yield work_dir, art_dir
    shutil.rmtree(work_dir, ignore_errors=True)
    shutil.rmtree(art_dir, ignore_errors=True)


def test_clean_audio_wav(test_dirs):
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "clean_tone.wav"

    # Generate 3 seconds of continuous 440 Hz tone
    sr = 16000
    t = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 440 * t)
    write_test_wav(wav_path, tone, sr=sr)

    ctx = AnalysisContext(case_id="case_audio_clean", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_aud_clean", "stored_path": str(wav_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.error is None

    # Check waveform and spectrogram artifacts
    wave_art = next((a for a in result.artifacts if a["kind"] == "waveform_json"), None)
    assert wave_art is not None
    assert Path(wave_art["path"]).exists()

    spec_art = next((a for a in result.artifacts if a["kind"] == "spectrogram_png"), None)
    assert spec_art is not None
    assert Path(spec_art["path"]).exists()


def test_spliced_audio_discontinuity_detection(test_dirs):
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "spliced.wav"

    # 6 seconds audio: 0.0 - 3.0s low tone; 3.0 - 6.0s loud high tone + loud noise
    sr = 16000
    t1 = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)
    t2 = np.linspace(0, 3.0, int(sr * 3.0), endpoint=False)

    part1 = 0.08 * np.sin(2 * np.pi * 220 * t1) + 0.01 * np.sin(2 * np.pi * 500 * t1)
    part2 = 0.85 * np.sin(2 * np.pi * 1200 * t2) + 0.3 * np.sin(2 * np.pi * 2800 * t2)

    combined = np.concatenate([part1, part2])
    write_test_wav(wav_path, combined, sr=sr)

    ctx = AnalysisContext(case_id="case_spliced", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_aud_spliced", "stored_path": str(wav_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    disc_obs = [o for o in result.observations if o.indicator in ("audio_discontinuity", "audio_noise_floor_shift")]
    assert len(disc_obs) >= 1

    # Verification requirement: Must flag anomaly within +/- 0.3s (2700 ms to 3300 ms) of 3.0s cut
    target_obs = next(
        (o for o in disc_obs if o.time_start_ms is not None and 2700 <= o.time_start_ms <= 3300),
        None
    )
    assert target_obs is not None, f"Expected discontinuity around 3000ms, found: {[o.time_start_ms for o in disc_obs]}"
    assert target_obs.evidence_strength in (Strength.weak, Strength.moderate)
    assert len(target_obs.alternative_explanation) > 0
    assert len(target_obs.limitations) > 0


def test_silent_audio_wav(test_dirs):
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "silent.wav"

    # 2 seconds of pure zero samples
    sr = 16000
    zeros = np.zeros(sr * 2, dtype=np.float32)
    write_test_wav(wav_path, zeros, sr=sr)

    ctx = AnalysisContext(case_id="case_silent", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_aud_silent", "stored_path": str(wav_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.error is None


def test_noisy_audio_wav(test_dirs):
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "noisy.wav"

    sr = 16000
    t = np.linspace(0, 2.5, int(sr * 2.5), endpoint=False)
    noise = (0.1 * np.sin(2 * np.pi * 317 * t) + 0.1 * np.sin(2 * np.pi * 719 * t) + 0.1 * np.sin(2 * np.pi * 1321 * t))
    write_test_wav(wav_path, noise, sr=sr)

    ctx = AnalysisContext(case_id="case_noisy", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_aud_noisy", "stored_path": str(wav_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.error is None
    assert len(result.artifacts) >= 2


def test_media_without_audio_stream(test_dirs):
    work_dir, art_dir = test_dirs
    video_no_audio = work_dir / "muted.mp4"

    from backend.app.services.safe_subprocess import run_ffmpeg
    run_ffmpeg([
        "-f", "lavfi",
        "-i", "color=c=black:duration=1:size=160x120:rate=10",
        "-c:v", "libx264",
        "-an",
        "-y", str(video_no_audio)
    ])

    ctx = AnalysisContext(case_id="case_no_audio", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_no_audio", "stored_path": str(video_no_audio)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    no_aud_obs = next((o for o in result.observations if o.indicator == "no_audio_stream"), None)
    assert no_aud_obs is not None
    assert no_aud_obs.evidence_strength == Strength.informational


def test_audio_spectrogram_observation_and_artifacts(test_dirs):
    """Verifies that analyze() emits audio_spectrogram Observation linked to waveform & spectrogram artifacts."""
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "clean_tone.wav"

    sr = 16000
    t = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 440 * t)
    write_test_wav(wav_path, tone, sr=sr)

    ctx = AnalysisContext(case_id="case_obs_test", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_aud_obs", "stored_path": str(wav_path)}

    result = analyze(evidence, ctx)
    assert result.status == "done"

    spec_obs = next((o for o in result.observations if o.indicator == "audio_spectrogram"), None)
    assert spec_obs is not None
    assert spec_obs.method == "stft_and_waveform_envelope"
    assert len(spec_obs.artifact_ids) == 2
    assert "spectrogram" in spec_obs.details
    assert spec_obs.details["duration_ms"] > 0
    assert spec_obs.details["sample_rate"] == 16000


def test_audio_formats_mp3_and_m4a(test_dirs):
    """Verifies that audio analyzer accepts and processes MP3 and M4A audio containers."""
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "sample.wav"
    mp3_path = work_dir / "sample.mp3"
    m4a_path = work_dir / "sample.m4a"

    sr = 16000
    t = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
    tone = 0.4 * np.sin(2 * np.pi * 440 * t)
    write_test_wav(wav_path, tone, sr=sr)

    from backend.app.services.safe_subprocess import run_ffmpeg
    run_ffmpeg(["-i", str(wav_path), "-vn", "-y", str(mp3_path)])
    run_ffmpeg(["-i", str(wav_path), "-vn", "-c:a", "aac", "-y", str(m4a_path)])

    if mp3_path.exists():
        ctx_mp3 = AnalysisContext(case_id="case_mp3", work_dir=str(work_dir), artifact_dir=str(art_dir))
        res_mp3 = analyze({"id": "ev_mp3", "stored_path": str(mp3_path)}, ctx_mp3)
        assert res_mp3.status == "done"
        assert any(o.indicator == "audio_spectrogram" for o in res_mp3.observations)

    if m4a_path.exists():
        ctx_m4a = AnalysisContext(case_id="case_m4a", work_dir=str(work_dir), artifact_dir=str(art_dir))
        res_m4a = analyze({"id": "ev_m4a", "stored_path": str(m4a_path)}, ctx_m4a)
        assert res_m4a.status == "done"
        assert any(o.indicator == "audio_spectrogram" for o in res_m4a.observations)


def test_audio_transcribe_fallback_observation(test_dirs):
    """Verifies that transcribe_audio emits speech_transcription_completed observation."""
    work_dir, art_dir = test_dirs
    wav_path = work_dir / "sample_speech.wav"

    sr = 16000
    t = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
    tone = 0.4 * np.sin(2 * np.pi * 440 * t)
    write_test_wav(wav_path, tone, sr=sr)

    from backend.app.analyzers.audio.transcribe import transcribe_audio
    status, obs, claims, artifacts, details = transcribe_audio(
        evidence_id="ev_transcribe",
        case_id="case_transcribe",
        wav_path=wav_path,
        artifact_dir=art_dir,
        evidence_meta={"transcript": "Testing transcription pipeline fallback"}
    )

    assert status == "done"
    trans_obs = next((o for o in obs if o.indicator == "speech_transcription_completed"), None)
    assert trans_obs is not None
    assert "Testing transcription pipeline fallback" in trans_obs.details["transcription"]["text"]
    assert len(trans_obs.artifact_ids) >= 1


