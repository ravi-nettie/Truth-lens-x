"""backend/app/analyzers/image/exif.py

Forensic EXIF metadata extraction and anomaly detection for TruthLens X.
Adheres strictly to Rule 2:
- Missing EXIF alone MUST be informational, never suspicious by itself
- Editor software tags flagged as weak with plain-language alternative explanations
- Emits Claim(source_kind="exif", claim_type="datetime") for DateTimeOriginal
"""

import datetime
import io
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import exifread
from PIL import Image

from shared.schemas import Claim, Modality, Observation, Strength


def parse_exif_datetime(dt_str: str) -> Optional[datetime.datetime]:
    """Parses EXIF timestamp formatted as 'YYYY:MM:DD HH:MM:SS' or ISO formats."""
    if not dt_str:
        return None
    cleaned = dt_str.strip()
    # Try standard EXIF format: 2023:10:15 14:30:00
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(cleaned[:19], fmt)
        except (ValueError, TypeError):
            continue
    try:
        return datetime.datetime.fromisoformat(cleaned)
    except Exception:
        return None

KNOWN_EDITORS = [
    "photoshop", "gimp", "lightroom", "canva", "snapseed", "vsco",
    "pixelmator", "pixlr", "affinity", "coreldraw", "paint.net",
    "picasa", "fotor", "afterlight", "facetune", "photoscape"
]


def extract_exif_metadata(image_path: Path) -> Dict[str, Any]:
    """Extracts raw and normalized EXIF tags using exifread and Pillow."""
    meta: Dict[str, Any] = {
        "make": None,
        "model": None,
        "software": None,
        "datetime_original": None,
        "modify_date": None,
        "has_gps": False,
        "gps_coords": None,
        "thumbnail_dimensions": None,
        "raw_tags_count": 0,
    }

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=True)
            meta["raw_tags_count"] = len(tags)

            if "Image Make" in tags:
                meta["make"] = str(tags["Image Make"]).strip()
            if "Image Model" in tags:
                meta["model"] = str(tags["Image Model"]).strip()
            if "Image Software" in tags:
                meta["software"] = str(tags["Image Software"]).strip()
            if "EXIF DateTimeOriginal" in tags:
                meta["datetime_original"] = str(tags["EXIF DateTimeOriginal"]).strip()
            if "Image DateTime" in tags:
                meta["modify_date"] = str(tags["Image DateTime"]).strip()

            # Check GPS
            gps_tags = [k for k in tags.keys() if k.startswith("GPS ")]
            if gps_tags:
                meta["has_gps"] = True

            # Thumbnail check
            if "JPEGThumbnail" in tags:
                thumb_bytes = tags["JPEGThumbnail"]
                try:
                    with Image.open(io.BytesIO(thumb_bytes)) as thumb:
                        meta["thumbnail_dimensions"] = thumb.size
                except Exception:
                    pass
    except Exception:
        pass

    # Secondary fallback via Pillow if exifread missed tags
    if not meta["software"] or not meta["datetime_original"]:
        try:
            with Image.open(image_path) as img:
                exif_data = img.getexif()
                if exif_data:
                    # Tag IDs: 305 = Software, 271 = Make, 272 = Model, 306 = DateTime
                    if not meta["software"] and 305 in exif_data:
                        meta["software"] = str(exif_data[305]).strip()
                    if not meta["make"] and 271 in exif_data:
                        meta["make"] = str(exif_data[271]).strip()
                    if not meta["model"] and 272 in exif_data:
                        meta["model"] = str(exif_data[272]).strip()
                    if not meta["modify_date"] and 306 in exif_data:
                        meta["modify_date"] = str(exif_data[306]).strip()
                    
                    # IFD sub-tags (34853 = GPS, 34665 = ExifIFD)
                    exif_ifd = exif_data.get_ifd(34665)
                    if exif_ifd and not meta["datetime_original"] and 36867 in exif_ifd:
                        meta["datetime_original"] = str(exif_ifd[36867]).strip()
        except Exception:
            pass

    return meta


def analyze_exif(
    evidence_id: str,
    case_id: str,
    image_path: Path
) -> Tuple[List[Observation], List[Claim], Dict[str, Any]]:
    """
    Forensic evaluation of EXIF metadata:
    - Flags missing EXIF as strictly 'informational'
    - Flags editor software detection as 'weak'
    - Emits Claim for DateTimeOriginal
    """
    observations: List[Observation] = []
    claims: List[Claim] = []
    meta = extract_exif_metadata(image_path)

    # 1. Missing EXIF Check (Rule 2: MUST be informational)
    if meta["raw_tags_count"] == 0 and not meta["software"] and not meta["datetime_original"]:
        observations.append(
            Observation(
                id=f"obs_exif_missing_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.image,
                indicator="missing_exif",
                method="exif_metadata_inspection",
                summary="No EXIF metadata found in image container",
                explanation="The image file does not contain standard Exif/TIFF metadata headers (e.g. camera make, lens model, or timestamp tags).",
                alternative_explanation="Social media platforms (WhatsApp, X, Facebook, Instagram) and privacy-focused messaging apps routinely strip EXIF metadata to protect user privacy and compress files for transmission.",
                evidence_strength=Strength.informational,
                limitations="Missing EXIF metadata is standard across web-distributed media and does not indicate or correlate with image tampering.",
                details={"raw_tags_count": 0}
            )
        )
        return observations, claims, meta

    # 2. Known Editor Software Detection
    software = meta.get("software")
    if software:
        sw_lower = software.lower()
        matched_editor = next((ed for ed in KNOWN_EDITORS if ed in sw_lower), None)
        if matched_editor:
            observations.append(
                Observation(
                    id=f"obs_exif_software_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.image,
                    indicator="editing_software_detected",
                    method="exif_software_tag_inspection",
                    summary=f"Image software tag indicates editor: {software}",
                    explanation=f"EXIF metadata indicates the image was processed or exported by '{software}', matching known image editor signatures.",
                    alternative_explanation="Image editing applications are routinely used for benign operations including legitimate cropping, resizing, color calibration, camera RAW conversion, or format transcoding without semantic manipulation.",
                    evidence_strength=Strength.weak,
                    limitations="EXIF software tags indicate that the file passed through an editing or viewing tool, but cannot distinguish between routine format re-export and content fabrication.",
                    details={"software_tag": software, "matched_editor": matched_editor}
                )
            )

    # 3. Emit Claim for DateTimeOriginal
    dto_str = meta.get("datetime_original")
    if dto_str:
        parsed_dt = parse_exif_datetime(dto_str)
        iso_str = parsed_dt.isoformat() if parsed_dt else dto_str
        claims.append(
            Claim(
                id=f"claim_exif_dto_{uuid4().hex[:8]}",
                case_id=case_id,
                source_evidence_id=evidence_id,
                source_kind="exif",
                text=f"Photo captured on {dto_str} (EXIF DateTimeOriginal)",
                claim_type="datetime",
                value={
                    "datetime_original": dto_str,
                    "iso8601": iso_str,
                    "field": "EXIF:DateTimeOriginal",
                    "make": meta.get("make"),
                    "model": meta.get("model")
                }
            )
        )

    # 4. Inconsistency between DateTimeOriginal and Container Modify Date
    mod_str = meta.get("modify_date")
    if dto_str and mod_str and dto_str != mod_str:
        observations.append(
            Observation(
                id=f"obs_exif_mismatch_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=Modality.image,
                indicator="exif_timestamp_divergence",
                method="exif_temporal_cross_check",
                summary="Capture date differs from container modification date",
                explanation=f"DateTimeOriginal ({dto_str}) differs from DateTime ({mod_str}) in image header.",
                alternative_explanation="File management tools, photo gallery organizers, and operating system backup utilities frequently update the container modification date while preserving the original capture timestamp.",
                evidence_strength=Strength.informational,
                limitations="Container date shifts occur routinely during file copying and cataloging.",
                details={"datetime_original": dto_str, "modify_date": mod_str}
            )
        )

    return observations, claims, meta
