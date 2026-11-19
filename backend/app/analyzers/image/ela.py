"""backend/app/analyzers/image/ela.py

Error Level Analysis (ELA) for TruthLens X.
Adheres strictly to Rule 2:
- Flags ELA findings as informational or weak visual aid ONLY
- Explicit, mandatory limitation that sharp edges/textures naturally light up in untouched photos
- Derived artifacts saved strictly to ctx.artifact_dir
- Pure functional design, no DB access, no unhandled exceptions
"""

import hashlib
import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import cv2
import numpy as np
from PIL import Image

from shared.schemas import Modality, Observation, Strength


def compute_ela(
    image: Image.Image,
    quality: int = 90
) -> Tuple[np.ndarray, np.ndarray, Dict[str, float]]:
    """
    Computes Error Level Analysis difference map and statistics.
    1. Saves image as JPEG at specified quality in memory
    2. Measures absolute difference per pixel
    3. Normalizes difference for visualization and calculates statistics
    """
    # Working copy must be RGB
    rgb_img = image.convert("RGB")
    orig_np = np.array(rgb_img, dtype=np.float32)

    # Re-save to in-memory buffer at specified quality
    buffer = io.BytesIO()
    rgb_img.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)

    # Load recompressed image
    recompressed = Image.open(buffer)
    recomp_np = np.array(recompressed, dtype=np.float32)

    # Absolute difference
    diff = np.abs(orig_np - recomp_np)
    diff_gray = np.mean(diff, axis=2)  # 2D grayscale diff

    # Compute statistics
    mean_val = float(np.mean(diff_gray))
    std_val = float(np.std(diff_gray))
    p95_val = float(np.percentile(diff_gray, 95))
    max_val = float(np.max(diff_gray))

    # Compute 8x8 block variance statistics
    h, w = diff_gray.shape
    h_blocks = h // 8
    w_blocks = w // 8
    if h_blocks > 0 and w_blocks > 0:
        blocks = diff_gray[:h_blocks * 8, :w_blocks * 8].reshape(h_blocks, 8, w_blocks, 8)
        block_means = blocks.mean(axis=(1, 3))
        max_block_diff = float(np.max(block_means))
        std_block_diff = float(np.std(block_means))
    else:
        max_block_diff = max_val
        std_block_diff = std_val

    stats = {
        "mean_diff": round(mean_val, 2),
        "std_diff": round(std_val, 2),
        "p95_diff": round(p95_val, 2),
        "max_diff": round(max_val, 2),
        "max_block_diff": round(max_block_diff, 2),
        "std_block_diff": round(std_block_diff, 2),
    }

    # Colorize heatmap: Scale up difference for visibility (scale factor ~ 10-15x capped at 255)
    # Using OpenCV COLORMAP_TURBO or COLORMAP_JET for high-contrast forensic visualization
    scaled_diff = np.clip(diff_gray * 12.0, 0, 255).astype(np.uint8)
    heatmap_bgr = cv2.applyColorMap(scaled_diff, cv2.COLORMAP_TURBO)
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)

    return diff_gray, heatmap_rgb, stats


def analyze_ela(
    evidence_id: str,
    case_id: str,
    image_path: Path,
    artifact_dir: Path,
    working_image: Optional[Image.Image] = None
) -> Tuple[List[Observation], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Performs ELA forensic analysis, produces heatmap artifact, and returns observations.
    """
    observations: List[Observation] = []
    artifacts: List[Dict[str, Any]] = []
    details: Dict[str, Any] = {}

    try:
        if working_image is not None:
            img = working_image
        else:
            img = Image.open(image_path)

        # Compute ELA
        diff_gray, heatmap_rgb, stats = compute_ela(img, quality=90)
        details.update(stats)

        # Save heatmap artifact
        artifact_id = f"art_ela_{uuid4().hex[:8]}"
        artifact_filename = f"ela_{evidence_id}.png"
        artifact_path = artifact_dir / artifact_filename

        heatmap_pil = Image.fromarray(heatmap_rgb)
        heatmap_pil.save(artifact_path, format="PNG")

        # Compute sha256
        with open(artifact_path, "rb") as f:
            art_sha256 = hashlib.sha256(f.read()).hexdigest()

        artifacts.append({
            "id": artifact_id,
            "case_id": case_id,
            "kind": "image_ela",
            "path": str(artifact_path),
            "sha256": art_sha256,
            "description": "Error Level Analysis (ELA) difference heatmap at JPEG quality 90"
        })

        # Forensic strength: Informational (or Weak if high block variance suggesting composite boundaries)
        # Never exceeds weak.
        if stats["max_block_diff"] > 35.0 and stats["std_block_diff"] > 8.0:
            strength = Strength.weak
            summary = "Elevated regional compression difference detected via Error Level Analysis"
            explanation = (
                f"Error Level Analysis at quality 90 reveals localized regions with elevated error levels "
                f"(max block diff {stats['max_block_diff']}, p95 diff {stats['p95_diff']}). "
                f"Different parts of the image show differing compression response characteristics."
            )
            alt_explanation = (
                "High-contrast physical textures (such as fine text, brickwork, hair, leaves, or sharp edges) "
                "naturally generate higher high-frequency DCT residual error during JPEG recompression without any splicing."
            )
        else:
            strength = Strength.informational
            summary = "Error Level Analysis completed across image frame"
            explanation = (
                f"Error Level Analysis difference map computed at quality 90 (mean diff {stats['mean_diff']}, "
                f"p95 diff {stats['p95_diff']}). Error distribution is relatively uniform across the container."
            )
            alt_explanation = (
                "Uniform JPEG recompression error distribution typical of single-source camera captures or uniformly exported images."
            )

        limitations = (
            "Error Level Analysis is a heuristic visual aid, NOT a conclusive tampering test. "
            "High-contrast textures and natural sharp edges inherently show elevated error levels in untouched original photos. "
            "Always interpret ELA heatmaps alongside EXIF metadata and structural copy-move or frequency checks."
        )

        observations.append(
            Observation(
                id=f"obs_ela_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.image,
                indicator="error_level_analysis",
                method="jpeg_error_level_analysis_90",
                summary=summary,
                explanation=explanation,
                alternative_explanation=alt_explanation,
                evidence_strength=strength,
                artifact_ids=[artifact_id],
                limitations=limitations,
                details=details
            )
        )

    except Exception as e:
        details["error"] = str(e)

    return observations, artifacts, details

