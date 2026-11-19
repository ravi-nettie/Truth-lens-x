#!/usr/bin/env bash
# scripts/make_demo_media.sh
# Generates synthetic media for TruthLens X demo and automated testing.
# Creates:
# 1. Edited image with copy-move patch + Photoshop EXIF
# 2. Clean control image with camera EXIF
# 3. Edited 14s video with scene cut & audio splice at 7.4s
# 4. Clean 6s control video with continuous stream
# 5. Contradictory social caption
# 6. Precomputed backup transcript JSON/TXT
# 7. Discontinuous 14s audio WAV

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Generating synthetic forensic demo media fixtures..."

if command -v python3 &>/dev/null; then
    python3 "$SCRIPT_DIR/make_demo_media.py"
elif command -v python &>/dev/null; then
    python "$SCRIPT_DIR/make_demo_media.py"
else
    echo "Python required to generate demo media."
    exit 1
fi

echo "Demo media generation completed successfully."
