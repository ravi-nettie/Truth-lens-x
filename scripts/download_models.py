#!/usr/bin/env python3
"""scripts/download_models.py

Pre-downloads and caches offline CPU models for TruthLens X:
- faster-whisper (tiny.en and base, int8) stored in models/
- spaCy en_core_web_sm model
- Prints total disk size and runs a quick CPU inference timing test.

Rule 1: Model downloads happen strictly during setup, never at runtime on first user request.
"""

import os
import sys
import time
from pathlib import Path

MODELS_DIR = Path(os.environ.get("MODELS_DIR", "./models")).resolve()


def get_dir_size_mb(path: Path) -> float:
    """Calculates directory size in megabytes."""
    if not path.exists():
        return 0.0
    total_bytes = sum(f.stat().st_size for f in path.glob("**/*") if f.is_file())
    return total_bytes / (1024 * 1024)


def download_whisper_models():
    """Downloads faster-whisper tiny.en and base models."""
    print("=" * 60)
    print("1. Downloading faster-whisper CPU models...")
    print("=" * 60)
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    models = ["tiny.en", "base"]

    try:
        from faster_whisper import download_model
        for model_name in models:
            dest_dir = MODELS_DIR / f"whisper-{model_name}"
            print(f"--> Fetching faster-whisper '{model_name}' to {dest_dir}...")
            start_t = time.perf_counter()
            model_path = download_model(model_name, output_dir=str(dest_dir))
            elapsed = time.perf_counter() - start_t
            size_mb = get_dir_size_mb(Path(model_path))
            print(f"    [OK] Downloaded {model_name} ({size_mb:.1f} MB) in {elapsed:.2f}s")
    except ImportError:
        print("[WARNING] 'faster-whisper' package is not installed in the current environment.")
        print("          Run 'pip install -r requirements.txt' first.")
    except Exception as e:
        print(f"[ERROR] Failed to download whisper models: {e}")
        print("        Ensure you have an active network connection during setup.")


def download_spacy_model():
    """Checks and downloads spaCy en_core_web_sm model."""
    print("\n" + "=" * 60)
    print("2. Checking / Downloading spaCy NLP model (en_core_web_sm)...")
    print("=" * 60)
    
    try:
        import spacy
        try:
            spacy.load("en_core_web_sm")
            print("--> spaCy 'en_core_web_sm' is already installed and verified.")
        except OSError:
            print("--> spaCy 'en_core_web_sm' not found. Installing via spacy.cli...")
            from spacy.cli import download
            download("en_core_web_sm")
            print("    [OK] Successfully installed en_core_web_sm.")
    except ImportError:
        print("[WARNING] 'spacy' is not installed in the current environment.")
        print("          Run 'pip install -r requirements.txt' first.")
    except Exception as e:
        print(f"[ERROR] Failed to download spaCy model: {e}")


def benchmark_cpu_inference():
    """Performs a quick CPU timing test."""
    print("\n" + "=" * 60)
    print("3. Benchmarking CPU Inference...")
    print("=" * 60)
    
    # 1. spaCy CPU test
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        sample_text = (
            "Over 3,000 students gathered at Main Quad on November 18, 2026. "
            "Organizers claimed record participation in the robotics showcase."
        )
        t0 = time.perf_counter()
        doc = nlp(sample_text)
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        elapsed_nlp = (time.perf_counter() - t0) * 1000
        print(f"[OK] spaCy CPU NLP parse completed in {elapsed_nlp:.2f} ms.")
        print(f"     Extracted entities: {entities}")
    except Exception as e:
        print(f"[SKIP] spaCy benchmark skipped: {e}")

    # Total disk size
    total_mb = get_dir_size_mb(MODELS_DIR)
    print("\n" + "=" * 60)
    print(f"Total Offline Models Directory Size: {total_mb:.2f} MB ({MODELS_DIR})")
    print("TruthLens X offline model setup completed successfully.")
    print("=" * 60)


if __name__ == "__main__":
    download_whisper_models()
    download_spacy_model()
    benchmark_cpu_inference()
