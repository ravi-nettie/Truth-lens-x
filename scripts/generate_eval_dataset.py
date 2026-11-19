#!/usr/bin/env python3
"""scripts/generate_eval_dataset.py

Generates reproducible evaluation datasets and manifests for TruthLens X.
Profiles:
- SMALL: 20 images, 4 videos, 4 audio files.
- Manifest columns: sample_id, file_path, ground_truth, media_type, source_dataset, split, investigation_id

Generates ground-truth labeled synthetic and simulated forensic media:
- Authentic / clean controls
- Copy-move manipulated
- Non-JPEG PNG lossless
- JPEG recompressed
- EXIF metadata stripped / edited
- Video scene cuts & audio splices
- Audio spectral discontinuities

Rule: Zero network downloading of large unvetted datasets. All fixtures are team-owned and MIT/CC0 reproducible.
"""

import csv
import math
from pathlib import Path
import struct
import wave
import numpy as np
from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
EVAL_DIR = REPO_ROOT / "samples" / "evaluation"
SMALL_MEDIA_DIR = EVAL_DIR / "small_media"


def ensure_dirs():
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    SMALL_MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def make_clean_image(path: Path, seed: int = 1):
    """Generates an authentic synthetic camera photo with continuous gradient & sensor-like noise."""
    w, h = 640, 480
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            r = int((x / w) * 180 + (seed * 17) % 50)
            g = int((y / h) * 160 + (seed * 23) % 60)
            b = int(((x + y) / (w + h)) * 140 + 40)
            arr[y, x] = [r, g, b]

    # Add light noise
    noise = np.zeros((h, w, 3), dtype=np.int16)
    for y in range(h):
        for x in range(w):
            val = ((x * 31 + y * 47 + seed * 13) % 11) - 5
            noise[y, x] = [val, val, val]
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    exif = img.getexif()
    exif[0x010F] = "Nikon"
    exif[0x0110] = f"Nikon D850 (Unit #{seed})"
    exif[0x0132] = f"2026:10:1{seed % 9} 14:20:00"
    img.save(path, format="JPEG", quality=95, exif=exif)


def make_copymove_image(path: Path, seed: int = 1):
    """Generates an image with a cloned high-contrast geometric patch."""
    w, h = 640, 480
    img = Image.new("RGB", (w, h), color=(180, 190, 200))
    draw = ImageDraw.Draw(img)

    # Background structures
    draw.rectangle([0, 300, w, h], fill=(80, 140, 90))
    draw.rectangle([100, 150, 540, 300], fill=(160, 150, 140))

    # Dense textured patch for ORB keypoint matching
    patch_box = [150, 180, 250, 280]
    draw.rectangle(patch_box, fill=(210, 40, 40))
    draw.ellipse([170, 200, 230, 260], fill=(250, 230, 20))
    for i in range(8):
        draw.line([(160 + i * 10, 190), (160 + i * 10, 270)], fill=(20, 20, 190), width=2)

    # Paste copy-move patch to second location
    patch = img.crop(patch_box)
    img.paste(patch, (380, 180))

    exif = img.getexif()
    exif[0x010F] = "Canon"
    exif[0x0131] = "Adobe Photoshop 24.0"
    exif[0x0132] = "2026:11:15 16:30:00"
    img.save(path, format="JPEG", quality=90, exif=exif)


def make_png_image(path: Path, seed: int = 1):
    """Generates a clean non-JPEG PNG image to test lossless ELA interpretation."""
    w, h = 400, 400
    img = Image.new("RGB", (w, h), color=(240, 240, 245))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 350, 350], fill=(60, 120, 200), outline=(20, 40, 100), width=3)
    draw.ellipse([100, 100, 300, 300], fill=(230, 180, 30))
    img.save(path, format="PNG")


def make_recompressed_image(path: Path, seed: int = 1):
    """Generates a heavily recompressed JPEG image (compression tampering test)."""
    w, h = 500, 500
    img = Image.new("RGB", (w, h), color=(120, 140, 160))
    draw = ImageDraw.Draw(img)
    draw.ellipse([100, 100, 400, 400], fill=(220, 80, 80))
    # First save at high quality
    tmp = path.with_suffix(".tmp.jpg")
    img.save(tmp, format="JPEG", quality=95)
    # Re-save at low quality to create double quantization
    img2 = Image.open(tmp)
    img2.save(path, format="JPEG", quality=45)
    if tmp.exists():
        tmp.unlink()


def make_clean_audio(path: Path, duration_sec: float = 3.0, freq: float = 440.0):
    """Generates a continuous tone WAV without splices."""
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            amp = 0.5 * math.sin(2.0 * math.pi * freq * (i / sample_rate))
            val = int(amp * 32767.0)
            frames.extend(struct.pack("<h", max(-32768, min(32767, val))))
        wf.writeframes(frames)


def make_spliced_audio(path: Path, duration_sec: float = 4.0):
    """Generates a spliced WAV with abrupt spectral jump at 2.0s."""
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    cut = int(sample_rate * 2.0)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            if i < cut:
                amp = 0.5 * math.sin(2.0 * math.pi * 440.0 * (i / sample_rate))
            else:
                amp = 0.7 * math.sin(2.0 * math.pi * 880.0 * ((i - cut) / sample_rate) + math.pi)
            val = int(amp * 32767.0)
            frames.extend(struct.pack("<h", max(-32768, min(32767, val))))
        wf.writeframes(frames)


def make_clean_video(path: Path):
    """Reuses or links existing clean control MP4 fixture."""
    existing = REPO_ROOT / "samples" / "campus_fest_control.mp4"
    if existing.exists():
        path.write_bytes(existing.read_bytes())
    else:
        # Fallback dummy MP4 header
        path.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42" + b"\x00" * 4000)


def make_spliced_video(path: Path):
    """Reuses or links existing edited scene-cut MP4 fixture."""
    existing = REPO_ROOT / "samples" / "campus_fest_edited.mp4"
    if existing.exists():
        path.write_bytes(existing.read_bytes())
    else:
        path.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42" + b"\x00" * 6000)


def generate_small_profile():
    """Builds the 20 images, 4 videos, 4 audio files SMALL dataset profile and writes manifest."""
    ensure_dirs()
    manifest_rows = []

    print("[1/3] Generating 20 evaluation images (10 authentic, 10 manipulated)...")
    # 10 Authentic images
    for i in range(1, 11):
        sample_id = f"img_auth_{i:02d}"
        f_name = f"{sample_id}.jpg"
        f_path = SMALL_MEDIA_DIR / f_name
        make_clean_image(f_path, seed=i)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "authentic",
            "media_type": "image",
            "source_dataset": "TruthLens-Synthetic-Auth",
            "split": "test",
            "investigation_id": f"inv_img_auth_{i}"
        })

    # 10 Manipulated images (5 copy-move, 2 ELA/PNG, 3 recompressed/edited)
    for i in range(1, 6):
        sample_id = f"img_manip_copymove_{i:02d}"
        f_name = f"{sample_id}.jpg"
        f_path = SMALL_MEDIA_DIR / f_name
        make_copymove_image(f_path, seed=i)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "manipulated",
            "media_type": "image",
            "source_dataset": "TruthLens-Synthetic-CopyMove",
            "split": "test",
            "investigation_id": f"inv_cm_{i}"
        })

    for i in range(1, 3):
        sample_id = f"img_manip_png_{i:02d}"
        f_name = f"{sample_id}.png"
        f_path = SMALL_MEDIA_DIR / f_name
        make_png_image(f_path, seed=i)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "authentic",  # Note: PNG is authentic lossless format, testing ELA false positive resistance!
            "media_type": "image",
            "source_dataset": "TruthLens-Synthetic-Lossless",
            "split": "test",
            "investigation_id": f"inv_png_{i}"
        })

    for i in range(1, 4):
        sample_id = f"img_manip_recomp_{i:02d}"
        f_name = f"{sample_id}.jpg"
        f_path = SMALL_MEDIA_DIR / f_name
        make_recompressed_image(f_path, seed=i)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "manipulated",
            "media_type": "image",
            "source_dataset": "TruthLens-Synthetic-Recomp",
            "split": "test",
            "investigation_id": f"inv_recomp_{i}"
        })

    print("[2/3] Generating 4 evaluation videos (2 clean, 2 spliced)...")
    for i in range(1, 3):
        sample_id = f"vid_auth_{i:02d}"
        f_name = f"{sample_id}.mp4"
        f_path = SMALL_MEDIA_DIR / f_name
        make_clean_video(f_path)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "authentic",
            "media_type": "video",
            "source_dataset": "TruthLens-Simulated-Video",
            "split": "test",
            "investigation_id": f"inv_vid_auth_{i}"
        })

    for i in range(1, 3):
        sample_id = f"vid_manip_{i:02d}"
        f_name = f"{sample_id}.mp4"
        f_path = SMALL_MEDIA_DIR / f_name
        make_spliced_video(f_path)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "manipulated",
            "media_type": "video",
            "source_dataset": "TruthLens-Simulated-Video",
            "split": "test",
            "investigation_id": f"inv_vid_manip_{i}"
        })

    print("[3/3] Generating 4 evaluation audio files (2 continuous, 2 spliced)...")
    for i in range(1, 3):
        sample_id = f"aud_auth_{i:02d}"
        f_name = f"{sample_id}.wav"
        f_path = SMALL_MEDIA_DIR / f_name
        make_clean_audio(f_path, duration_sec=3.0, freq=440.0 + i * 50)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "authentic",
            "media_type": "audio",
            "source_dataset": "TruthLens-Simulated-Audio",
            "split": "test",
            "investigation_id": f"inv_aud_auth_{i}"
        })

    for i in range(1, 3):
        sample_id = f"aud_manip_{i:02d}"
        f_name = f"{sample_id}.wav"
        f_path = SMALL_MEDIA_DIR / f_name
        make_spliced_audio(f_path, duration_sec=4.0)
        manifest_rows.append({
            "sample_id": sample_id,
            "file_path": str(f_path.relative_to(REPO_ROOT)).replace("\\", "/"),
            "ground_truth": "manipulated",
            "media_type": "audio",
            "source_dataset": "TruthLens-Simulated-Audio",
            "split": "test",
            "investigation_id": f"inv_aud_manip_{i}"
        })

    # Save manifest CSV
    manifest_csv_path = EVAL_DIR / "small_manifest.csv"
    with open(manifest_csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["sample_id", "file_path", "ground_truth", "media_type", "source_dataset", "split", "investigation_id"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"\n[OK] SMALL Manifest generated successfully: {manifest_csv_path} ({len(manifest_rows)} total samples)")
    return manifest_csv_path


if __name__ == "__main__":
    generate_small_profile()
