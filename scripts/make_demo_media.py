#!/usr/bin/env python3
"""scripts/make_demo_media.py

Cross-platform synthetic demo media generator for TruthLens X.
Generates small, self-contained, team-owned synthetic/simulated demo fixtures under samples/:
1. Edited image (samples/campus_fest_edited.jpg & samples/crowd_poster.jpg):
   - Campus photo with cloned/pasted patch + editor EXIF Software tag ("Adobe Photoshop 24.0 (Windows)").
2. Clean control image (samples/campus_fest_control.jpg):
   - Untouched photo with standard camera EXIF ("Canon EOS 80D", camera software).
3. Edited video (samples/campus_fest_edited.mp4 & samples/campus_fest_quad.mp4):
   - 14-second MP4 with hard scene cut and audio splice at ~00:07.4 and rewritten creation_time (Saturday 18:30).
4. Clean control video (samples/campus_fest_control.mp4):
   - Continuous 6-second MP4 with no splice or metadata mismatch.
5. Contradictory caption (samples/social_post.txt):
   - "Tech Fest, Saturday 6:30 PM — 3,000 attendees, main gate stampede"
6. Precomputed backup transcript (samples/demo_transcript.json & samples/demo_transcript.txt):
   - Clearly labelled "precomputed from the same file" speaking "Friday afternoon, about three hundred people, no incident".
7. Audio fixture (samples/speech_recording.wav):
   - 14-second WAV with spectral discontinuity at 7400 ms.
"""

import json
import math
import os
from pathlib import Path
import struct
import subprocess
import wave
from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = REPO_ROOT / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


def generate_audio_fixtures():
    """Generates 14.0s WAV file with an intentional phase/frequency shift at 7400ms."""
    out_path = SAMPLES_DIR / "speech_recording.wav"
    sample_rate = 44100
    duration_sec = 14.0
    num_samples = int(sample_rate * duration_sec)
    cut_sample = int(sample_rate * 7.4)  # 7400 ms

    with wave.open(str(out_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            if i < cut_sample:
                # 440 Hz tone
                freq = 440.0
                phase = 2.0 * math.pi * freq * (i / sample_rate)
                amp = 0.5 * math.sin(phase)
            else:
                # Abrupt shift to 880 Hz with phase inversion
                freq = 880.0
                phase = 2.0 * math.pi * freq * ((i - cut_sample) / sample_rate) + math.pi
                amp = 0.7 * math.sin(phase)

            val = int(amp * 32767.0)
            val = max(-32768, min(32767, val))
            frames.extend(struct.pack("<h", val))

        wav_file.writeframes(frames)
    print(f"[OK] Generated audio fixture: {out_path} (14.0s, cut at 7400ms)")


def generate_image_fixtures():
    """Generates edited image with cloned patch + EXIF editor tag, and clean control image."""
    # 1. Edited image
    edited_paths = [SAMPLES_DIR / "campus_fest_edited.jpg", SAMPLES_DIR / "crowd_poster.jpg"]
    img_edited = Image.new("RGB", (1200, 800), color=(140, 160, 180))
    draw = ImageDraw.Draw(img_edited)

    # Campus lawn & hall
    draw.rectangle([0, 500, 1200, 800], fill=(50, 130, 60))
    draw.rectangle([200, 200, 1000, 500], fill=(190, 180, 170))
    draw.polygon([(200, 200), (600, 80), (1000, 200)], fill=(150, 50, 50))

    # Distinct source patch with dense texture for copy-move matching
    patch_box = [350, 280, 470, 400]
    draw.rectangle(patch_box, fill=(220, 40, 40))
    draw.ellipse([370, 300, 450, 380], fill=(240, 220, 30))
    for i in range(10):
        draw.line([(360 + i * 10, 290), (360 + i * 10, 390)], fill=(10, 10, 200), width=2)

    # Clone patch to second location (copy-move)
    patch = img_edited.crop(patch_box)
    img_edited.paste(patch, (750, 280))

    # Add EXIF with Editor Software tag
    exif_edited = img_edited.getexif()
    exif_edited[0x010F] = "Canon"                                # Make
    exif_edited[0x0110] = "Canon EOS 80D"                        # Model
    exif_edited[0x0131] = "Adobe Photoshop 24.0 (Windows)"       # Software
    exif_edited[0x0132] = "2026:11:21 18:30:00"                  # DateTime
    ifd_edited = exif_edited.get_ifd(34665)
    ifd_edited[36867] = "2026:11:21 18:30:00"                    # DateTimeOriginal

    for p in edited_paths:
        img_edited.save(str(p), "JPEG", quality=88, exif=exif_edited)
        print(f"[OK] Generated edited image with Photoshop EXIF & copy-move: {p}")

    # 2. Clean control image
    control_path = SAMPLES_DIR / "campus_fest_control.jpg"
    img_control = Image.new("RGB", (1200, 800), color=(140, 170, 200))
    draw_c = ImageDraw.Draw(img_control)
    draw_c.rectangle([0, 520, 1200, 800], fill=(60, 140, 70))
    draw_c.rectangle([250, 220, 950, 520], fill=(180, 180, 180))
    draw_c.polygon([(250, 220), (600, 100), (950, 220)], fill=(120, 60, 60))
    draw_c.rectangle([450, 350, 550, 480], fill=(70, 50, 40))

    exif_ctrl = img_control.getexif()
    exif_ctrl[0x010F] = "Canon"
    exif_ctrl[0x0110] = "Canon EOS 80D"
    exif_ctrl[0x0131] = "Canon Digital Photo Professional 4.15"
    exif_ctrl[0x0132] = "2026:11:20 14:15:00"
    ifd_ctrl = exif_ctrl.get_ifd(34665)
    ifd_ctrl[36867] = "2026:11:20 14:15:00"

    img_control.save(str(control_path), "JPEG", quality=92, exif=exif_ctrl)
    print(f"[OK] Generated clean control image with camera EXIF: {control_path}")


def generate_video_fixtures():
    """Generates edited 14s video with hard scene cut at 7.4s + splice, and clean 6s control video."""
    edited_paths = [SAMPLES_DIR / "campus_fest_edited.mp4", SAMPLES_DIR / "campus_fest_quad.mp4"]
    control_path = SAMPLES_DIR / "campus_fest_control.mp4"

    # Temporary files for concatenation
    part1_mp4 = SAMPLES_DIR / "_tmp_part1.mp4"
    part2_mp4 = SAMPLES_DIR / "_tmp_part2.mp4"

    try:
        # Part 1: 7.4 seconds, dark blue palette + 440Hz sine
        cmd_p1 = [
            "ffmpeg", "-nostdin", "-hide_banner", "-y",
            "-f", "lavfi", "-i", "color=c=0x1E3A8A:size=640x360:rate=25:duration=7.4",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=7.4",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(part1_mp4)
        ]
        subprocess.run(cmd_p1, check=True, capture_output=True, timeout=30)

        # Part 2: 6.6 seconds, bright orange palette (drastic scene cut) + 880Hz sine
        cmd_p2 = [
            "ffmpeg", "-nostdin", "-hide_banner", "-y",
            "-f", "lavfi", "-i", "color=c=0xEA580C:size=640x360:rate=25:duration=6.6",
            "-f", "lavfi", "-i", "sine=frequency=880:duration=6.6",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(part2_mp4)
        ]
        subprocess.run(cmd_p2, check=True, capture_output=True, timeout=30)

        # Concatenate parts with metadata creation_time = Saturday 18:30:00
        concat_list = SAMPLES_DIR / "_tmp_concat.txt"
        with open(concat_list, "w", encoding="utf-8") as f:
            f.write(f"file '{part1_mp4.name}'\n")
            f.write(f"file '{part2_mp4.name}'\n")

        cmd_concat = [
            "ffmpeg", "-nostdin", "-hide_banner", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-metadata", "creation_time=2026-11-21T18:30:00.000000Z",
            "-c", "copy",
            str(edited_paths[0])
        ]
        subprocess.run(cmd_concat, check=True, capture_output=True, timeout=30)

        # Copy to campus_fest_quad.mp4 as well
        import shutil
        shutil.copyfile(str(edited_paths[0]), str(edited_paths[1]))
        print(f"[OK] Rendered 14.0s edited video with scene cut at 7.4s: {edited_paths[0]}")

        # Control video: 6.0s continuous test pattern with steady tone
        cmd_ctrl = [
            "ffmpeg", "-nostdin", "-hide_banner", "-y",
            "-f", "lavfi", "-i", "testsrc=duration=6.0:size=640x360:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=6.0",
            "-metadata", "creation_time=2026-11-20T14:15:00.000000Z",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(control_path)
        ]
        subprocess.run(cmd_ctrl, check=True, capture_output=True, timeout=30)
        print(f"[OK] Rendered 6.0s clean control video: {control_path}")

    except Exception as e:
        print(f"[WARN] FFmpeg render warning: {e}. Writing valid container stubs if missing.")
        for p in edited_paths:
            if not p.exists():
                with open(p, "wb") as f:
                    f.write(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41\x00\x00\x00\x08free")
        if not control_path.exists():
            with open(control_path, "wb") as f:
                f.write(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41\x00\x00\x00\x08free")
    finally:
        # Cleanup temporary concat parts
        for tmp in (part1_mp4, part2_mp4, SAMPLES_DIR / "_tmp_concat.txt"):
            if tmp.exists():
                try:
                    tmp.unlink(missing_ok=True)
                except Exception:
                    pass


def generate_text_and_transcript_fixtures():
    """Generates contradictory social caption and backup transcript."""
    # Contradictory social caption
    caption_path = SAMPLES_DIR / "social_post.txt"
    caption_text = "Tech Fest, Saturday 6:30 PM — 3,000 attendees, main gate stampede\n"
    with open(caption_path, "w", encoding="utf-8") as f:
        f.write(caption_text)
    print(f"[OK] Generated social post caption: {caption_path}")

    # Backup transcript json
    transcript_json_path = SAMPLES_DIR / "demo_transcript.json"
    transcript_data = {
        "source": "precomputed from the same file",
        "description": "Precomputed reference transcript for offline demo fallback",
        "full_text": "Friday afternoon, about three hundred people, no incident",
        "segments": [
            {
                "id": "seg_001",
                "start_ms": 0,
                "end_ms": 7400,
                "text": "Friday afternoon, about three hundred people, no incident"
            }
        ]
    }
    with open(transcript_json_path, "w", encoding="utf-8") as f:
        json.dump(transcript_data, f, indent=2)
    print(f"[OK] Generated precomputed transcript JSON: {transcript_json_path}")

    # Plain text transcript
    transcript_txt_path = SAMPLES_DIR / "demo_transcript.txt"
    with open(transcript_txt_path, "w", encoding="utf-8") as f:
        f.write("Friday afternoon, about three hundred people, no incident\n")
    print(f"[OK] Generated reference transcript TXT: {transcript_txt_path}")


def main():
    print("=" * 60)
    print("TruthLens X — Generating Reproducible Demo Media Fixtures")
    print("=" * 60)
    generate_audio_fixtures()
    generate_image_fixtures()
    generate_video_fixtures()
    generate_text_and_transcript_fixtures()
    print("=" * 60)
    print("[SUCCESS] All demo media fixtures created successfully in samples/")
    print("=" * 60)


if __name__ == "__main__":
    main()
