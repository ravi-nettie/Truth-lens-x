"""backend/app/analyzers/image/jpeg.py

Forensic JPEG quantization and compression analysis for TruthLens X.
Adheres strictly to Rule 2:
- Flags compression / quality characteristics as informational or weak
- Mandatory plain-language alternative_explanation and limitations
- Pure functional design, no DB access, no unhandled exceptions
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import numpy as np
from PIL import Image

from shared.schemas import Modality, Observation, Strength


# Standard IJG 50% Luminance Quantization Matrix
STANDARD_LUMINANCE_50 = np.array([
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99
], dtype=np.float32)


def estimate_jpeg_quality(quant_table: List[int]) -> int:
    """
    Estimates JPEG compression quality factor (1-100) from the luminance quantization table
    using standard IJG scaling formula approximation.
    """
    if len(quant_table) != 64:
        return 75

    q_arr = np.array(quant_table, dtype=np.float32)
    # Ratio relative to standard 50% matrix
    ratios = q_arr / STANDARD_LUMINANCE_50
    # Median ratio to be robust against custom entries
    scaling_factor = float(np.median(ratios)) * 100.0

    if scaling_factor <= 0:
        return 100
    elif scaling_factor < 100:
        quality = 5000.0 / scaling_factor
    else:
        quality = (200.0 - scaling_factor) / 2.0

    return int(np.clip(np.round(quality), 1, 100))


def analyze_jpeg(
    evidence_id: str,
    case_id: str,
    image_path: Path
) -> Tuple[List[Observation], Dict[str, Any]]:
    """
    Forensic analysis of JPEG compression artifacts & quantization tables.
    """
    observations: List[Observation] = []
    details: Dict[str, Any] = {
        "is_jpeg": False,
        "quantization_tables": {},
        "estimated_quality": None,
    }

    try:
        with Image.open(image_path) as img:
            if img.format not in ("JPEG", "MPO"):
                # Clean skip for PNG, WebP, TIFF, etc.
                return observations, details

            details["is_jpeg"] = True
            quant = getattr(img, "quantization", None)
            if not quant:
                return observations, details

            q_tables_serialized = {}
            est_quality = None

            for table_idx, table_data in quant.items():
                if isinstance(table_data, (list, tuple)):
                    q_list = [int(v) for v in table_data]
                elif hasattr(table_data, "tolist"):
                    q_list = [int(v) for v in table_data.tolist()]
                else:
                    q_list = [int(v) for v in list(table_data)]

                q_tables_serialized[str(table_idx)] = q_list
                if table_idx == 0:
                    est_quality = estimate_jpeg_quality(q_list)

            details["quantization_tables"] = q_tables_serialized
            details["estimated_quality"] = est_quality

            if est_quality is not None:
                # 1. Very heavy compression
                if est_quality < 65:
                    observations.append(
                        Observation(
                            id=f"obs_jpeg_heavy_comp_{uuid4().hex[:8]}",
                            case_id=case_id,
                            evidence_id=evidence_id,
                            modality=Modality.image,
                            indicator="heavy_jpeg_compression",
                            method="jpeg_quantization_table_analysis",
                            summary=f"Heavy JPEG compression detected (est. quality ~{est_quality}%)",
                            explanation=(
                                f"Luminance quantization table indicates coarse frequency quantization with an "
                                f"estimated compression quality of {est_quality}%. High-frequency 8x8 DCT coefficients "
                                f"have been heavily suppressed."
                            ),
                            alternative_explanation=(
                                "Mobile network transmission, cellular messaging, web publishing platforms, and social networks "
                                "routinely re-compress uploaded photos at lower quality settings (typically 50-70%) to save bandwidth."
                            ),
                            evidence_strength=Strength.weak,
                            limitations=(
                                "Low JPEG quality factor indicates aggressive compression history across transmission channels, "
                                "but cannot prove malicious tampering. In fact, heavy compression can mask or mimic subtle pixel edits."
                            ),
                            details={"estimated_quality": est_quality, "table_count": len(q_tables_serialized)}
                        )
                    )
                # 2. Informational quality report
                else:
                    observations.append(
                        Observation(
                            id=f"obs_jpeg_meta_{uuid4().hex[:8]}",
                            case_id=case_id,
                            evidence_id=evidence_id,
                            modality=Modality.image,
                            indicator="jpeg_quantization_profile",
                            method="jpeg_quantization_table_analysis",
                            summary=f"JPEG container inspected (est. quality ~{est_quality}%)",
                            explanation=(
                                f"Image container uses standard discrete cosine transform (DCT) compression "
                                f"with {len(q_tables_serialized)} quantization tables and an estimated quality factor of {est_quality}%."
                            ),
                            alternative_explanation=(
                                "Standard digital camera or editing software encoding parameter."
                            ),
                            evidence_strength=Strength.informational,
                            limitations=(
                                "Quantization parameters reflect container encoding settings, not spatial integrity."
                            ),
                            details={"estimated_quality": est_quality, "table_count": len(q_tables_serialized)}
                        )
                    )

    except Exception as e:
        # Never raise unhandled exception
        details["error"] = str(e)

    return observations, details

