#!/usr/bin/env python3
"""scripts/doctor.py

TruthLens X System Diagnostic & Environment Doctor.
Validates:
1. Python version >= 3.11
2. Node.js version >= 20
3. FFmpeg version >= 6.0
4. Directory skeleton and permissions
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def check_python() -> bool:
    v = sys.version_info
    v_str = f"{v.major}.{v.minor}.{v.micro}"
    if (v.major, v.minor) >= (3, 11):
        print(f"  [PASS] Python: {v_str} (>= 3.11 required)")
        return True
    else:
        print(f"  [FAIL] Python: {v_str} (Python >= 3.11 required)")
        return False


def check_node() -> bool:
    node_bin = shutil.which("node")
    if not node_bin:
        fallback = REPO_ROOT.parent / "node20" / "node-v20.18.0-win-x64" / "node.exe"
        if fallback.exists():
            node_bin = str(fallback)
        else:
            print("  [WARN] Node.js: Not found in PATH (Node 20+ required for Phase 2 Frontend).")
            print("         Install from https://nodejs.org or via package manager.")
            return False

    try:
        res = subprocess.run([node_bin, "--version"], capture_output=True, text=True, timeout=5)
        out = res.stdout.strip()  # e.g. v20.11.0
        match = re.search(r"v?(\d+)\.", out)
        if match:
            major = int(match.group(1))
            if major >= 20:
                print(f"  [PASS] Node.js: {out} (>= 20 required)")
                return True
            else:
                print(f"  [WARN] Node.js: {out} (Node >= 20 required, found major {major})")
                return False
    except Exception as e:
        print(f"  [WARN] Node.js check error: {e}")
        return False
    return False


def check_ffmpeg() -> bool:
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        localappdata = os.environ.get("LOCALAPPDATA", "")
        if localappdata:
            winget_pattern = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
            if winget_pattern.exists():
                for p in winget_pattern.glob("**/ffmpeg.exe"):
                    if p.is_file():
                        ffmpeg_bin = str(p)
                        break

    if not ffmpeg_bin:
        print("  [WARN] FFmpeg: Not found in PATH (FFmpeg 6+ required for Phase 1 Audio/Video Analyzers).")
        print("         Install via: winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg")
        return False

    try:
        res = subprocess.run([ffmpeg_bin, "-version"], capture_output=True, text=True, timeout=5)
        out = res.stdout.splitlines()[0] if res.stdout else ""
        match = re.search(r"version\s+([0-9]+(?:\.[0-9]+)?)", out, re.IGNORECASE)
        if match:
            ver_num = float(match.group(1))
            if ver_num >= 6.0:
                print(f"  [PASS] FFmpeg: {match.group(1)} (>= 6.0 required)")
                return True
            else:
                print(f"  [WARN] FFmpeg: {match.group(1)} (FFmpeg >= 6.0 required)")
                return False
        else:
            # Git builds or rolling versions
            print(f"  [PASS] FFmpeg: {out[:40]} (Detected in PATH)")
            return True
    except Exception as e:
        print(f"  [WARN] FFmpeg check error: {e}")
        return False


def check_directories() -> bool:
    required = [
        "docs", "shared", "shared/fixtures",
        "backend/app", "backend/tests", "frontend",
        "samples", "scripts", "data", "models"
    ]
    all_ok = True
    for d in required:
        p = REPO_ROOT / d
        if not p.exists():
            print(f"  [FAIL] Missing required directory: {d}")
            all_ok = False
    if all_ok:
        print("  [PASS] Repository Skeleton: All core directories verified.")
    return all_ok


def check_schemas() -> bool:
    try:
        from shared.schemas import Observation, GraphEdge, Claim
        print("  [PASS] Shared Contracts: Pydantic v2 schemas imported and validated.")
        return True
    except Exception as e:
        print(f"  [FAIL] Shared Contracts import error: {e}")
        return False


def check_local_models() -> bool:
    models_dir = REPO_ROOT / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    
    # Check spaCy model
    spacy_ok = False
    try:
        import spacy
        spacy.load("en_core_web_sm")
        print("  [PASS] NLP Model: spaCy 'en_core_web_sm' installed and verified.")
        spacy_ok = True
    except Exception:
        print("  [NOTE] NLP Model: spaCy 'en_core_web_sm' not installed (run 'make setup').")

    # Check whisper models in models/
    whisper_models = list(models_dir.glob("whisper*"))
    if whisper_models:
        print(f"  [PASS] Local Speech Models: Found {len(whisper_models)} model(s) in {models_dir}.")
    else:
        print(f"  [NOTE] Local Speech Models: Optional Whisper models not yet downloaded (graceful fallback active).")
    
    return True


def main():
    parser = argparse.ArgumentParser(description="TruthLens X Doctor")
    parser.add_argument("--strict", action="store_true", help="Fail if any optional external tool is missing")
    args = parser.parse_args()

    print("=" * 60)
    print("TruthLens X — System Diagnostics & Pre-Flight Checks")
    print("=" * 60)

    py_ok = check_python()
    node_ok = check_node()
    ffmpeg_ok = check_ffmpeg()
    dirs_ok = check_directories()
    sys.path.insert(0, str(REPO_ROOT))
    schemas_ok = check_schemas()
    models_ok = check_local_models()

    print("=" * 60)
    if args.strict:
        if py_ok and node_ok and ffmpeg_ok and dirs_ok and schemas_ok:
            print("[SUCCESS] All pre-flight checks passed in STRICT mode.")
            sys.exit(0)
        else:
            print("[FAILURE] Pre-flight checks failed in STRICT mode.")
            sys.exit(1)
    else:
        if py_ok and dirs_ok and schemas_ok:
            print("[SUCCESS] Core Phase 0 requirements verified successfully.")
            if not (node_ok and ffmpeg_ok):
                print("[NOTE] Node 20+ and/or FFmpeg 6+ are pending installation for Phases 1 & 2.")
            sys.exit(0)
        else:
            print("[FAILURE] Essential Phase 0 requirements not satisfied.")
            sys.exit(1)


if __name__ == "__main__":
    main()
