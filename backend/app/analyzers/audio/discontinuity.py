"""backend/app/analyzers/audio/discontinuity.py

Deterministic Audio Discontinuity and Acoustic Splice Analysis for TruthLens X.
Adheres strictly to Rule 2:
- Flags spectral flux, noise-floor shifts, digital silence, and clipping anomalies
- Evidence strength capped at moderate (or weak for mild silence/clipping)
- Mandatory plain-language alternative_explanation and limitations
- Pure functional design, no DB access, no unhandled exceptions
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4
import wave

import cv2
import numpy as np

from shared.schemas import Modality, Observation, Strength


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


def compute_spectral_flux(
    samples: np.ndarray,
    sr: int = 16000,
    n_fft: int = 512,
    hop_length: int = 256,
    k_mad: float = 7.0,
    merge_ms: int = 250
) -> List[Dict[str, Any]]:
    """
    Computes spectral flux across STFT frames via cv2.dft and identifies peaks exceeding median + k * MAD.
    Merges peaks within merge_ms (default 250 ms).
    """
    total_samples = len(samples)
    if total_samples < n_fft:
        return []

    hann = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(n_fft) / float(n_fft))).astype(np.float32)
    num_frames = (total_samples - n_fft) // hop_length + 1

    if num_frames < 2:
        return []

    # Compute magnitude spectra
    mags = []
    frame_times_sec = []
    for i in range(num_frames):
        start = i * hop_length
        chunk = samples[start:start + n_fft] * hann
        dft = cv2.dft(chunk, flags=cv2.DFT_COMPLEX_OUTPUT)
        mag = np.sqrt(dft[:, 0] ** 2 + dft[:, 1] ** 2)[:n_fft // 2 + 1]
        mags.append(mag)
        frame_times_sec.append((start + n_fft / 2.0) / float(sr))

    mag_matrix = np.column_stack(mags)  # [freq_bins, num_frames]

    # Half-wave rectified spectral flux
    diff = mag_matrix[:, 1:] - mag_matrix[:, :-1]
    rectified_diff = np.maximum(0.0, diff)
    flux = np.sum(rectified_diff, axis=0)  # [num_frames - 1]

    if len(flux) == 0:
        return []

    med = float(np.median(flux))
    mad = float(np.median(np.abs(flux - med)))
    threshold = med + (k_mad * max(mad, 1e-6))

    peak_indices = np.where(flux > threshold)[0]
    if len(peak_indices) == 0:
        return []

    raw_peaks: List[Dict[str, Any]] = []
    for idx in peak_indices:
        t_sec = frame_times_sec[min(idx + 1, len(frame_times_sec) - 1)]
        ms = int(round(t_sec * 1000.0))
        ratio = float(flux[idx] / max(med, 1e-6))
        raw_peaks.append({"ms": ms, "flux_val": float(flux[idx]), "ratio_to_median": round(ratio, 2)})

    # Merge peaks within merge_ms
    merged: List[Dict[str, Any]] = []
    current_cluster = [raw_peaks[0]]

    for p in raw_peaks[1:]:
        if p["ms"] - current_cluster[-1]["ms"] <= merge_ms:
            current_cluster.append(p)
        else:
            start_ms = max(0, current_cluster[0]["ms"] - 40)
            end_ms = current_cluster[-1]["ms"] + 40
            max_ratio = max(item["ratio_to_median"] for item in current_cluster)
            merged.append({
                "time_start_ms": start_ms,
                "time_end_ms": end_ms,
                "ratio_to_median": max_ratio,
                "peak_count": len(current_cluster),
                "threshold": round(threshold, 3),
                "median": round(med, 3)
            })
            current_cluster = [p]

    if current_cluster:
        start_ms = max(0, current_cluster[0]["ms"] - 40)
        end_ms = current_cluster[-1]["ms"] + 40
        max_ratio = max(item["ratio_to_median"] for item in current_cluster)
        merged.append({
            "time_start_ms": start_ms,
            "time_end_ms": end_ms,
            "ratio_to_median": max_ratio,
            "peak_count": len(current_cluster),
            "threshold": round(threshold, 3),
            "median": round(med, 3)
        })

    return merged


def compute_noise_floor_shifts(
    samples: np.ndarray,
    sr: int = 16000,
    window_sec: float = 0.5,
    db_jump_threshold: float = 8.5
) -> List[Dict[str, Any]]:
    """
    Computes ambient background noise-floor estimates across adjacent 0.5 s windows
    and detects abrupt dB shifts.
    """
    samples_per_win = int(round(window_sec * sr))
    num_windows = len(samples) // samples_per_win
    if num_windows < 2:
        return []

    block_size = max(1, samples_per_win // 10)
    noise_db_levels = []

    for w in range(num_windows):
        win_samples = samples[w * samples_per_win:(w + 1) * samples_per_win]
        sub_rms = []
        for b in range(0, len(win_samples) - block_size + 1, block_size):
            chunk = win_samples[b:b + block_size]
            rms = np.sqrt(np.mean(chunk ** 2))
            sub_rms.append(rms)
        p10 = float(np.percentile(sub_rms, 10)) if sub_rms else 1e-6
        db = 20.0 * np.log10(max(p10, 1e-6))
        noise_db_levels.append(db)

    shifts: List[Dict[str, Any]] = []
    for i in range(1, len(noise_db_levels)):
        delta = abs(noise_db_levels[i] - noise_db_levels[i - 1])
        if delta >= db_jump_threshold:
            shift_ms = int(round(i * window_sec * 1000.0))
            shifts.append({
                "time_start_ms": max(0, shift_ms - 250),
                "time_end_ms": shift_ms + 250,
                "delta_db": round(delta, 2),
                "prev_db": round(noise_db_levels[i - 1], 2),
                "curr_db": round(noise_db_levels[i], 2)
            })

    return shifts


def compute_digital_silence_runs(
    samples: np.ndarray,
    sr: int = 16000,
    min_silence_ms: int = 150,
    silence_threshold: float = 1e-5
) -> List[Dict[str, Any]]:
    """
    Detects continuous runs of digital silence (near-zero amplitude) exceeding min_silence_ms.
    """
    min_samples = int(round((min_silence_ms / 1000.0) * sr))
    is_silent = np.abs(samples) <= silence_threshold

    runs: List[Dict[str, Any]] = []
    if len(samples) == 0:
        return runs

    overall_rms = float(np.sqrt(np.mean(samples ** 2)))
    if overall_rms <= silence_threshold * 2:
        return []

    padded = np.concatenate(([False], is_silent, [False]))
    diff = np.diff(padded.astype(np.int8))
    starts = np.where(diff == 1)[0]
    ends = np.where(diff == -1)[0]

    for s, e in zip(starts, ends):
        length = e - s
        if length >= min_samples:
            start_ms = int(round((s / float(sr)) * 1000.0))
            end_ms = int(round((e / float(sr)) * 1000.0))
            runs.append({
                "time_start_ms": start_ms,
                "time_end_ms": end_ms,
                "duration_ms": end_ms - start_ms,
                "sample_count": int(length)
            })

    return runs


def compute_clipping_and_dc(
    samples: np.ndarray,
    sr: int = 16000,
    clip_thresh: float = 0.999
) -> Dict[str, Any]:
    """
    Calculates clipping ratio and DC bias offset.
    """
    if len(samples) == 0:
        return {"clipping_ratio": 0.0, "dc_offset": 0.0, "is_clipped": False}

    clipped_count = int(np.sum(np.abs(samples) >= clip_thresh))
    ratio = clipped_count / float(len(samples))
    dc = float(np.mean(samples))

    return {
        "clipping_ratio": round(ratio, 4),
        "clipped_samples": clipped_count,
        "dc_offset": round(dc, 4),
        "is_clipped": ratio > 0.005
    }


def analyze_audio_discontinuities(
    evidence_id: str,
    case_id: str,
    wav_path: Path
) -> Tuple[List[Observation], Dict[str, Any]]:
    """
    Forensic analysis of spectral flux, noise-floor continuity, digital silence, and clipping.
    """
    observations: List[Observation] = []
    details: Dict[str, Any] = {
        "spectral_flux_peaks": [],
        "noise_floor_shifts": [],
        "silence_runs": [],
        "clipping_stats": {}
    }

    try:
        sr, samples = read_mono_wav(wav_path)
        if len(samples) == 0:
            return observations, details

        # 1. Spectral Flux Peaks
        flux_peaks = compute_spectral_flux(samples, sr=sr, k_mad=7.0, merge_ms=250)
        details["spectral_flux_peaks"] = flux_peaks

        # 2. Background Noise Floor Shifts
        noise_shifts = compute_noise_floor_shifts(samples, sr=sr, window_sec=0.5, db_jump_threshold=8.5)
        details["noise_floor_shifts"] = noise_shifts

        # 3. Digital Silence Runs
        silence_runs = compute_digital_silence_runs(samples, sr=sr, min_silence_ms=150)
        details["silence_runs"] = silence_runs

        # 4. Clipping and DC offset
        clip_dc = compute_clipping_and_dc(samples, sr=sr)
        details["clipping_stats"] = clip_dc

        # Correlate Spectral Flux & Noise Floor to produce primary Discontinuity Observations
        for fp in flux_peaks:
            matching_shift = next(
                (ns for ns in noise_shifts if abs(ns["time_start_ms"] - fp["time_start_ms"]) <= 500),
                None
            )

            if matching_shift:
                strength = Strength.moderate
                summary = f"Abrupt acoustic discontinuity detected at {round(fp['time_start_ms'] / 1000.0, 2)}s"
                explanation = (
                    f"Sharp spectral energy flux peak ({fp['ratio_to_median']}x median) coupled with a "
                    f"{matching_shift['delta_db']} dB shift in background ambient noise floor between "
                    f"{round(fp['time_start_ms'] / 1000.0, 2)}s and {round(fp['time_end_ms'] / 1000.0, 2)}s."
                )
            else:
                strength = Strength.moderate if fp["ratio_to_median"] >= 10.0 else Strength.weak
                summary = f"Spectral flux peak detected at {round(fp['time_start_ms'] / 1000.0, 2)}s"
                explanation = (
                    f"Transient spectral flux spike ({fp['ratio_to_median']}x baseline median) observed "
                    f"across audio frame at {round(fp['time_start_ms'] / 1000.0, 2)}s."
                )

            alt_exp = (
                "Natural vocal plosive, speaker turn transition, microphone bump, clothing rustle, "
                "door closure, or automatic gain control (AGC) adjustment."
            )
            limitations = (
                "Background ambient noise, musical accompaniment, acoustic reverberation, and lossy compression codecs "
                "(such as AAC or MP3) degrade spectral flux precision. Discontinuity indicates acoustic variation, not proof of tampering."
            )

            observations.append(
                Observation(
                    id=f"obs_audio_disc_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.audio,
                    indicator="audio_discontinuity",
                    method="spectral_flux_and_noise_floor_analysis",
                    summary=summary,
                    explanation=explanation,
                    alternative_explanation=alt_exp,
                    evidence_strength=strength,
                    time_start_ms=fp["time_start_ms"],
                    time_end_ms=fp["time_end_ms"],
                    limitations=limitations,
                    details={"spectral_peak": fp, "noise_shift": matching_shift}
                )
            )

        # Standalone noise shifts without flux peaks
        for ns in noise_shifts:
            has_matching_flux = any(abs(fp["time_start_ms"] - ns["time_start_ms"]) <= 500 for fp in flux_peaks)
            if not has_matching_flux:
                observations.append(
                    Observation(
                        id=f"obs_audio_noise_shift_{uuid4().hex[:8]}",
                        case_id=case_id,
                        evidence_id=evidence_id,
                        modality=Modality.audio,
                        indicator="audio_noise_floor_shift",
                        method="background_noise_floor_envelope",
                        summary=f"Ambient noise-floor level shift ({ns['delta_db']} dB) at {round(ns['time_start_ms'] / 1000.0, 2)}s",
                        explanation=(
                            f"Background ambient noise level shifted by {ns['delta_db']} dB (from {ns['prev_db']} dB "
                            f"to {ns['curr_db']} dB) across adjacent 0.5s windows."
                        ),
                        alternative_explanation="HVAC cycling, passing vehicle, microphone proximity change, or AGC adjustment.",
                        evidence_strength=Strength.weak,
                        time_start_ms=ns["time_start_ms"],
                        time_end_ms=ns["time_end_ms"],
                        limitations="Ambient acoustic environments naturally fluctuate in volume over time.",
                        details=ns
                    )
                )

        # Digital silence observations
        for sr_run in silence_runs:
            observations.append(
                Observation(
                    id=f"obs_audio_silence_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.audio,
                    indicator="digital_silence_run",
                    method="sample_amplitude_zero_run_check",
                    summary=f"Digital silence run ({sr_run['duration_ms']}ms) detected at {round(sr_run['time_start_ms'] / 1000.0, 2)}s",
                    explanation=(
                        f"Exact digital zero amplitude maintained continuously for {sr_run['duration_ms']}ms "
                        f"({sr_run['sample_count']} samples) within an active audio recording."
                    ),
                    alternative_explanation="Digital noise gate, VOX mute between sentences, or transmission dropout.",
                    evidence_strength=Strength.weak,
                    time_start_ms=sr_run["time_start_ms"],
                    time_end_ms=sr_run["time_end_ms"],
                    limitations="Digital silence is commonly introduced by noise reduction filters and VOX hardware.",
                    details=sr_run
                )
            )

        # Clipping observation
        if clip_dc["is_clipped"]:
            observations.append(
                Observation(
                    id=f"obs_audio_clipping_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.audio,
                    indicator="audio_clipping_distortion",
                    method="waveform_peak_clipping_check",
                    summary=f"Audio signal peak clipping detected ({round(clip_dc['clipping_ratio'] * 100, 2)}% samples clipped)",
                    explanation="Audio waveform peaks exceed the maximum dynamic range (+/- 1.0), causing waveform saturation flat-topping.",
                    alternative_explanation="Over-amplification, microphone positioned too close to speaker, or excessive gain setting.",
                    evidence_strength=Strength.weak,
                    limitations="Clipping indicates recording gain overload and can mask or create acoustic artifacts.",
                    details=clip_dc
                )
            )

    except Exception as e:
        details["error"] = str(e)

    return observations, details
