"""backend/app/analyzers/image/run.py

Pure-function image analyzer orchestrator for TruthLens X (Module 13A).
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Signature: def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult
- CPU-only, 100% offline, local-first
- Pure function: no DB access, no modification of original files
- Never raises unhandled exceptions (returns status="failed" with human-readable error)
- Downscales working copy if longest side > 2000 px and tracks in details & limitations
- Aggregates EXIF, JPEG quantization, ELA, and Copy-Move analyzers
"""

import os
from pathlib import Path
from typing import Any, Dict, List
from PIL import Image

from shared.schemas import AnalysisContext, AnalyzerResult, Claim, Observation
from backend.app.analyzers.image.exif import KNOWN_EDITORS, analyze_exif
from backend.app.analyzers.image.jpeg import analyze_jpeg
from backend.app.analyzers.image.ela import analyze_ela
from backend.app.analyzers.image.copymove import analyze_copymove


MAX_ANALYSIS_DIMENSION = 2000


def analyze(evidence: Dict[str, Any], ctx: AnalysisContext) -> AnalyzerResult:
    """
    Forensic image analyzer executing EXIF, JPEG, ELA, and Copy-Move pipelines.
    """
    evidence_id = evidence.get("id", "unknown_evidence")
    case_id = ctx.case_id
    stored_path_str = evidence.get("stored_path")

    if not stored_path_str or not os.path.exists(stored_path_str):
        return AnalyzerResult(
            status="failed",
            error=f"Evidence file not found at path: {stored_path_str}",
            tool_version="1.0.0"
        )

    image_path = Path(stored_path_str)
    artifact_dir = Path(ctx.artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    all_observations: List[Observation] = []
    all_claims: List[Claim] = []
    all_artifacts: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {
        "modality": "image",
        "downscaled_for_analysis": False,
        "original_dimensions": None,
        "analysis_dimensions": None,
    }

    try:
        # 1. Structural Verification & Header Check
        try:
            with Image.open(image_path) as test_img:
                test_img.verify()
        except Exception as e:
            return AnalyzerResult(
                status="failed",
                error=f"Corrupt or unreadable image container: {e}",
                tool_version="1.0.0"
            )

        # 2. Open Working Copy and Normalize
        with Image.open(image_path) as raw_img:
            orig_w, orig_h = raw_img.size
            metadata["original_dimensions"] = [orig_w, orig_h]
            metadata["format"] = raw_img.format
            metadata["mode"] = raw_img.mode

            # Convert to RGB (handles CMYK, Palette, Grayscale, RGBA)
            working_copy = raw_img.convert("RGB")

            # Check if downscaling required
            longest_side = max(orig_w, orig_h)
            scale_factor = 1.0

            if longest_side > MAX_ANALYSIS_DIMENSION:
                scale_factor = longest_side / float(MAX_ANALYSIS_DIMENSION)
                new_w = int(round(orig_w / scale_factor))
                new_h = int(round(orig_h / scale_factor))
                working_copy = working_copy.resize((new_w, new_h), Image.Resampling.LANCZOS)
                metadata["downscaled_for_analysis"] = True
                metadata["analysis_dimensions"] = [new_w, new_h]
                metadata["scale_factor"] = round(scale_factor, 4)
            else:
                metadata["analysis_dimensions"] = [orig_w, orig_h]

            # 3. EXIF Analysis
            exif_obs, exif_claims, exif_meta = analyze_exif(evidence_id, case_id, image_path)
            all_observations.extend(exif_obs)
            all_claims.extend(exif_claims)
            metadata["exif"] = exif_meta

            # Determine if editor software is detected
            has_editor_metadata = False
            sw = exif_meta.get("software")
            if sw:
                sw_lower = sw.lower()
                has_editor_metadata = any(ed in sw_lower for ed in KNOWN_EDITORS)

            # 4. JPEG Quantization Analysis
            jpeg_obs, jpeg_details = analyze_jpeg(evidence_id, case_id, image_path)
            all_observations.extend(jpeg_obs)
            metadata["jpeg"] = jpeg_details

            # 5. Error Level Analysis (ELA)
            ela_obs, ela_artifacts, ela_details = analyze_ela(
                evidence_id,
                case_id,
                image_path,
                artifact_dir,
                working_image=working_copy,
                original_format=raw_img.format
            )
            # If downscaled, note in details/limitations
            if metadata["downscaled_for_analysis"]:
                for obs in ela_obs:
                    obs.details["downscaled_for_analysis"] = True
                    obs.limitations += f" Image was downscaled from {orig_w}x{orig_h} to {metadata['analysis_dimensions'][0]}x{metadata['analysis_dimensions'][1]} for analysis."
            all_observations.extend(ela_obs)
            all_artifacts.extend(ela_artifacts)
            metadata["ela"] = ela_details

            # 6. Copy-Move Forgery Analysis
            cm_obs, cm_artifacts, cm_details = analyze_copymove(
                evidence_id,
                case_id,
                image_path,
                artifact_dir,
                working_image=working_copy,
                scale_factor=scale_factor,
                has_editor_metadata=has_editor_metadata
            )
            if metadata["downscaled_for_analysis"]:
                for obs in cm_obs:
                    obs.details["downscaled_for_analysis"] = True
                    obs.limitations += f" Feature matching performed on downscaled working copy ({metadata['analysis_dimensions'][0]}x{metadata['analysis_dimensions'][1]}); bounding boxes mapped back to original coordinates."
            all_observations.extend(cm_obs)
            all_artifacts.extend(cm_artifacts)
            metadata["copymove"] = cm_details

        return AnalyzerResult(
            status="done",
            observations=all_observations,
            claims=all_claims,
            artifacts=all_artifacts,
            metadata=metadata,
            tool_version="1.0.0"
        )

    except Exception as e:
        return AnalyzerResult(
            status="failed",
            error=f"Image analyzer error: {str(e)}",
            tool_version="1.0.0"
        )
