"""backend/tests/unit/test_image_analyzer.py

Unit tests for TruthLens X Image Forensics (Module 13A).
Tests:
- Clean JPEG container inspection
- PNG without EXIF (Rule 2: strictly informational)
- Copy-move duplication detection with RANSAC inliers & overlay artifact
- Downscaling large image (> 2000px) working copy
- Corrupt/unreadable file error handling (Rule 3: no unhandled exceptions)
"""

import tempfile
import shutil
from pathlib import Path
import pytest
from PIL import Image, ImageDraw

from shared.schemas import AnalysisContext, Strength
from backend.app.analyzers.image.run import analyze


@pytest.fixture
def test_dirs():
    work_dir = Path(tempfile.mkdtemp())
    art_dir = Path(tempfile.mkdtemp())
    yield work_dir, art_dir
    shutil.rmtree(work_dir, ignore_errors=True)
    shutil.rmtree(art_dir, ignore_errors=True)


def test_clean_jpeg_image(test_dirs):
    work_dir, art_dir = test_dirs
    img_path = work_dir / "clean.jpg"

    # Create solid/gradient image
    img = Image.new("RGB", (640, 480), color=(100, 150, 200))
    img.save(img_path, format="JPEG", quality=85)

    ctx = AnalysisContext(case_id="case_clean_img", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_clean_img", "stored_path": str(img_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.error is None
    assert len(result.artifacts) >= 1

    # Check ELA artifact was created
    ela_art = next((a for a in result.artifacts if a["kind"] == "image_ela"), None)
    assert ela_art is not None
    assert Path(ela_art["path"]).exists()

    # Rule 2: Missing EXIF must be informational
    missing_exif = next((o for o in result.observations if o.indicator == "missing_exif"), None)
    assert missing_exif is not None
    assert missing_exif.evidence_strength == Strength.informational


def test_png_without_exif(test_dirs):
    work_dir, art_dir = test_dirs
    img_path = work_dir / "test.png"

    img = Image.new("RGBA", (400, 300), color=(255, 128, 0, 255))
    img.save(img_path, format="PNG")

    ctx = AnalysisContext(case_id="case_png", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_png", "stored_path": str(img_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    missing_exif = next((o for o in result.observations if o.indicator == "missing_exif"), None)
    assert missing_exif is not None
    assert missing_exif.evidence_strength == Strength.informational


def test_copymove_detection(test_dirs):
    work_dir, art_dir = test_dirs
    img_path = work_dir / "copymove.jpg"

    # Draw complex distinct feature patch
    img = Image.new("RGB", (800, 600), color=(220, 220, 220))
    draw = ImageDraw.Draw(img)
    for i in range(10, 90, 5):
        draw.line([(50 + i, 50), (50, 50 + i)], fill=(20, 30, i * 2), width=2)
        draw.ellipse([(60 + i, 60), (70 + i, 70)], fill=(i * 2, 200 - i * 2, 100))

    # Clone the patch to another location
    patch = img.crop((50, 50, 180, 180))
    img.paste(patch, (450, 320))
    img.save(img_path, format="JPEG", quality=95)

    ctx = AnalysisContext(case_id="case_cm", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_cm", "stored_path": str(img_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    cm_obs = next((o for o in result.observations if o.indicator == "copy_move_duplication"), None)
    assert cm_obs is not None
    assert cm_obs.evidence_strength in (Strength.weak, Strength.moderate)
    assert cm_obs.region is not None
    assert cm_obs.region.w > 0 and cm_obs.region.h > 0
    assert len(cm_obs.alternative_explanation) > 0
    assert len(cm_obs.limitations) > 0

    # Overlay artifact check
    cm_art = next((a for a in result.artifacts if a["kind"] == "image_copymove_overlay"), None)
    assert cm_art is not None
    assert Path(cm_art["path"]).exists()


def test_downscaling_large_image(test_dirs):
    work_dir, art_dir = test_dirs
    img_path = work_dir / "large.jpg"

    # 2400 x 1200 image exceeds 2000px cap
    img = Image.new("RGB", (2400, 1200), color=(150, 150, 150))
    img.save(img_path, format="JPEG", quality=80)

    ctx = AnalysisContext(case_id="case_large", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_large", "stored_path": str(img_path)}

    result = analyze(evidence, ctx)

    assert result.status == "done"
    assert result.metadata["downscaled_for_analysis"] is True
    assert result.metadata["original_dimensions"] == [2400, 1200]
    assert result.metadata["analysis_dimensions"][0] <= 2000


def test_corrupt_image_handling(test_dirs):
    work_dir, art_dir = test_dirs
    corrupt_path = work_dir / "corrupt.jpg"

    # Write truncated/garbage header
    with open(corrupt_path, "wb") as f:
        f.write(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01truncatedgarbagepayload")

    ctx = AnalysisContext(case_id="case_corrupt", work_dir=str(work_dir), artifact_dir=str(art_dir))
    evidence = {"id": "ev_corrupt", "stored_path": str(corrupt_path)}

    result = analyze(evidence, ctx)

    # Rule 3: Never raise unhandled exception; return status="failed" with human error
    assert result.status == "failed"
    assert result.error is not None
    assert "corrupt" in result.error.lower() or "unreadable" in result.error.lower()

