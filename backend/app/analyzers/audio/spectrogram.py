"""backend/app/analyzers/audio/spectrogram.py

Waveform envelope extraction and mel/STFT spectrogram visualization for TruthLens X.
Adheres strictly to Rule 1 and Rule 3:
- Local-first, CPU-only, 100% offline
- Uses standard library wave + OpenCV cv2.dft + matplotlib (Agg backend)
- Artifacts saved strictly to ctx.artifact_dir with sha256 tracking
- Pure functional design, no DB access, no unhandled exceptions
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4
import wave

# Non-interactive Agg backend before importing matplotlib
os.environ["MPLBACKEND"] = "Agg"
import matplotlib
matplotlib.use("Agg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg

import cv2
import numpy as np


def read_mono_wav(wav_path: Path) -> Tuple[int, np.ndarray]:
    """Reads 16-bit PCM WAV into normalized [-1.0, 1.0] float32 mono array."""
    with wave.open(str(wav_path), "rb") as wf:
        sr = wf.getframerate()
        n_channels = wf.getnchannels()
        n_frames = wf.getnframes()
        raw_bytes = wf.readframes(n_frames)

        if wf.getsampwidth() == 2:
            data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        elif wf.getsampwidth() == 1:
            data = (np.frombuffer(raw_bytes, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        elif wf.getsampwidth() == 4:
            data = np.frombuffer(raw_bytes, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            data = np.frombuffer(raw_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        if n_channels > 1:
            data = data.reshape(-1, n_channels)[:, 0]

        return sr, data


def compute_stft_matrix(
    samples: np.ndarray,
    n_fft: int = 512,
    hop_length: int = 256
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes STFT magnitude matrix using OpenCV cv2.dft.
    Returns:
    - Sxx: shape [n_freq_bins, n_frames]
    - times: array of frame center times in seconds
    """
    total_samples = len(samples)
    if total_samples < n_fft:
        pad = np.zeros(n_fft - total_samples, dtype=np.float32)
        samples = np.concatenate([samples, pad])
        total_samples = n_fft

    hann = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(n_fft) / float(n_fft))).astype(np.float32)

    frames = []
    times = []
    num_frames = max(1, (total_samples - n_fft) // hop_length + 1)

    for i in range(num_frames):
        start = i * hop_length
        chunk = samples[start:start + n_fft] * hann
        dft = cv2.dft(chunk, flags=cv2.DFT_COMPLEX_OUTPUT)
        mag = np.sqrt(dft[:, 0] ** 2 + dft[:, 1] ** 2)[:n_fft // 2 + 1]
        frames.append(mag)
        times.append((start + n_fft / 2.0) / 16000.0)

    Sxx = np.column_stack(frames)  # [n_freq_bins, n_frames]
    return Sxx, np.array(times, dtype=np.float32)


def generate_waveform_and_spectrogram(
    evidence_id: str,
    case_id: str,
    wav_path: Path,
    artifact_dir: Path,
    bucket_ms: int = 50
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Computes waveform JSON envelope and spectrogram PNG artifact.
    """
    artifacts: List[Dict[str, Any]] = []
    telemetry: Dict[str, Any] = {
        "duration_ms": 0,
        "sample_rate": 16000,
        "total_samples": 0,
        "peak_amplitude": 0.0,
        "rms_amplitude": 0.0,
    }

    try:
        sr, samples = read_mono_wav(wav_path)
        total_samples = len(samples)
        duration_ms = int(round((total_samples / float(sr)) * 1000.0)) if sr > 0 else 0
        telemetry["duration_ms"] = duration_ms
        telemetry["sample_rate"] = sr
        telemetry["total_samples"] = total_samples
        telemetry["peak_amplitude"] = round(float(np.max(np.abs(samples))) if total_samples > 0 else 0.0, 4)
        telemetry["rms_amplitude"] = round(float(np.sqrt(np.mean(samples ** 2))) if total_samples > 0 else 0.0, 4)

        if total_samples == 0:
            return artifacts, telemetry

        # 1. Compute Compact Waveform Envelope JSON
        samples_per_bucket = max(1, int(round((bucket_ms / 1000.0) * sr)))
        num_buckets = int(np.ceil(total_samples / float(samples_per_bucket)))

        buckets: List[Dict[str, float]] = []
        for b in range(num_buckets):
            start_idx = b * samples_per_bucket
            end_idx = min(total_samples, start_idx + samples_per_bucket)
            chunk = samples[start_idx:end_idx]
            if len(chunk) > 0:
                b_min = float(np.min(chunk))
                b_max = float(np.max(chunk))
                b_rms = float(np.sqrt(np.mean(chunk ** 2)))
                buckets.append({
                    "min": round(b_min, 3),
                    "max": round(b_max, 3),
                    "rms": round(b_rms, 3)
                })

        envelope_data = {
            "evidence_id": evidence_id,
            "duration_ms": duration_ms,
            "sample_rate": sr,
            "bucket_ms": bucket_ms,
            "bucket_count": len(buckets),
            "buckets": buckets
        }

        waveform_art_id = f"art_wave_{uuid4().hex[:8]}"
        waveform_filename = f"waveform_{evidence_id}.json"
        waveform_path = artifact_dir / waveform_filename

        with open(waveform_path, "w", encoding="utf-8") as f:
            json.dump(envelope_data, f)

        with open(waveform_path, "rb") as f:
            wave_sha256 = hashlib.sha256(f.read()).hexdigest()

        artifacts.append({
            "id": waveform_art_id,
            "case_id": case_id,
            "kind": "waveform_json",
            "path": str(waveform_path),
            "sha256": wave_sha256,
            "description": f"Waveform envelope JSON ({bucket_ms}ms resolution, {duration_ms}ms total)"
        })

        # 2. Compute Mel / STFT Spectrogram PNG
        n_fft = 512
        hop = 256
        Sxx, times = compute_stft_matrix(samples, n_fft=n_fft, hop_length=hop)
        freqs = np.linspace(0, sr / 2.0, n_fft // 2 + 1)

        # Power in dB
        Sxx_db = 10.0 * np.log10(np.clip(Sxx ** 2, 1e-10, None))

        fig = Figure(figsize=(10, 4), dpi=100, layout="constrained")
        canvas = FigureCanvasAgg(fig)
        ax = fig.add_subplot(111)

        vmin, vmax = -80.0, float(np.max(Sxx_db))
        mesh = ax.pcolormesh(times, freqs, Sxx_db, shading="auto", cmap="magma", vmin=vmin, vmax=max(vmin + 10, vmax))
        ax.set_title("Audio Spectrogram (STFT Frequency vs Time)", fontsize=11, fontweight="bold")
        ax.set_ylabel("Frequency (Hz)", fontsize=9)
        ax.set_xlabel("Time (s)", fontsize=9)
        ax.set_ylim(0, sr // 2)
        cbar = fig.colorbar(mesh, ax=ax)
        cbar.set_label("Power (dB)", fontsize=8)

        spectrogram_art_id = f"art_spec_{uuid4().hex[:8]}"
        spectrogram_filename = f"spectrogram_{evidence_id}.png"
        spectrogram_path = artifact_dir / spectrogram_filename

        fig.savefig(spectrogram_path, format="png")

        with open(spectrogram_path, "rb") as f:
            spec_sha256 = hashlib.sha256(f.read()).hexdigest()

        artifacts.append({
            "id": spectrogram_art_id,
            "case_id": case_id,
            "kind": "spectrogram_png",
            "path": str(spectrogram_path),
            "sha256": spec_sha256,
            "description": f"High-resolution audio spectrogram ({sr} Hz, STFT nperseg={n_fft})"
        })

    except Exception as e:
        telemetry["error"] = str(e)

    return artifacts, telemetry
