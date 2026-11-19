"""backend/app/analyzers/video/probe.py

Forensic video container, codec, and stream inspection using safe ffprobe subprocess.
Adheres strictly to Rule 2 and Rule 4:
- All ffprobe calls pass through safe_subprocess with -nostdin -hide_banner -protocol_whitelist file
- Missing metadata / standard encoder tags flagged as informational or weak
- Emits Claim(source_kind="metadata", claim_type="datetime") if creation_time exists
- Pure functional design, no DB access, no unhandled exceptions
"""

import datetime
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Claim, Modality, Observation, Strength
from backend.app.services.safe_subprocess import run_ffprobe


MAX_VIDEO_DURATION_SEC = 300.0


def parse_fps_fraction(fps_str: Optional[str]) -> Optional[float]:
    """Parses fractional frame rate strings like '30/1' or '30000/1001'."""
    if not fps_str or fps_str == "0/0":
        return None
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/")
            den_f = float(den)
            return float(num) / den_f if den_f != 0 else None
        return float(fps_str)
    except Exception:
        return None


def probe_video(
    evidence_id: str,
    case_id: str,
    video_path: Path
) -> Tuple[List[Observation], List[Claim], Dict[str, Any]]:
    """
    Executes safe ffprobe to extract container metadata, stream parameters, and timestamps.
    """
    observations: List[Observation] = []
    claims: List[Claim] = []
    meta: Dict[str, Any] = {
        "duration_sec": 0.0,
        "width": 0,
        "height": 0,
        "video_codec": None,
        "audio_codec": None,
        "avg_fps": None,
        "r_fps": None,
        "is_vfr": False,
        "creation_time": None,
        "encoder": None,
        "capped_duration": False,
        "streams": []
    }

    cmd_args = [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(video_path)
    ]

    try:
        res = run_ffprobe(cmd_args, timeout_sec=20.0)
        if res.returncode != 0:
            return observations, claims, meta

        data = json.loads(res.stdout)
        fmt = data.get("format", {})
        streams = data.get("streams", [])

        # Format metadata
        duration_sec = float(fmt.get("duration", 0.0))
        meta["duration_sec"] = duration_sec
        tags = fmt.get("tags", {})
        meta["encoder"] = tags.get("encoder") or tags.get("major_brand")

        # Creation time lookup
        creation_time = (
            tags.get("creation_time") or
            tags.get("com.apple.quicktime.creationdate") or
            tags.get("date")
        )
        meta["creation_time"] = creation_time

        # Duration Cap Check
        if duration_sec > MAX_VIDEO_DURATION_SEC:
            meta["capped_duration"] = True
            observations.append(
                Observation(
                    id=f"obs_video_dur_cap_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.video,
                    indicator="video_duration_capped",
                    method="container_duration_inspection",
                    summary=f"Video duration ({round(duration_sec, 1)}s) capped to {int(MAX_VIDEO_DURATION_SEC)}s",
                    explanation=(
                        f"Video file duration exceeds the local analysis threshold of {int(MAX_VIDEO_DURATION_SEC)} seconds. "
                        f"Forensic frame sampling and scene detection are constrained to the first {int(MAX_VIDEO_DURATION_SEC)} seconds."
                    ),
                    alternative_explanation="Standard operational constraint for local CPU-bound forensic processing.",
                    evidence_strength=Strength.informational,
                    limitations=f"Content occurring beyond {int(MAX_VIDEO_DURATION_SEC)} seconds was omitted from detailed frame analysis.",
                    details={"total_duration_sec": duration_sec, "analyzed_cap_sec": MAX_VIDEO_DURATION_SEC}
                )
            )

        # Emit Claim for creation_time if present
        if creation_time:
            parsed_dt = None
            try:
                # Simple ISO or standard parse
                import datetime
                for f in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
                    try:
                        parsed_dt = datetime.datetime.strptime(creation_time[:19], f[:len(creation_time[:19])])
                        break
                    except Exception:
                        continue
                if not parsed_dt:
                    parsed_dt = datetime.datetime.fromisoformat(creation_time.replace("Z", "+00:00"))
            except Exception:
                pass

            iso_val = parsed_dt.isoformat() if parsed_dt else creation_time
            claims.append(
                Claim(
                    id=f"claim_video_time_{uuid4().hex[:8]}",
                    case_id=case_id,
                    source_evidence_id=evidence_id,
                    source_kind="metadata",
                    text=f"Video recorded on {creation_time} (Container Creation Time)",
                    claim_type="datetime",
                    value={
                        "creation_time": creation_time,
                        "iso8601": iso_val,
                        "encoder": meta.get("encoder"),
                        "duration_sec": duration_sec
                    }
                )
            )

        # Inspect Streams
        for s in streams:
            codec_type = s.get("codec_type")
            meta["streams"].append({
                "index": s.get("index"),
                "codec_type": codec_type,
                "codec_name": s.get("codec_name"),
                "bit_rate": s.get("bit_rate")
            })

            if codec_type == "video" and not meta["video_codec"]:
                meta["video_codec"] = s.get("codec_name")
                meta["width"] = int(s.get("width", 0))
                meta["height"] = int(s.get("height", 0))

                avg_fps = parse_fps_fraction(s.get("avg_frame_rate"))
                r_fps = parse_fps_fraction(s.get("r_frame_rate"))
                meta["avg_fps"] = avg_fps
                meta["r_fps"] = r_fps

                # Variable Frame Rate (VFR) Check
                if avg_fps and r_fps and abs(avg_fps - r_fps) > 0.5:
                    meta["is_vfr"] = True
                    observations.append(
                        Observation(
                            id=f"obs_video_vfr_{uuid4().hex[:8]}",
                            case_id=case_id,
                            evidence_id=evidence_id,
                            modality=Modality.video,
                            indicator="variable_frame_rate",
                            method="stream_fps_consistency_check",
                            summary=f"Variable Frame Rate (VFR) container detected (avg {round(avg_fps, 2)} fps vs nominal {round(r_fps, 2)} fps)",
                            explanation=(
                                f"Video stream exhibits divergence between nominal frame rate ({r_fps}) and "
                                f"average frame rate ({round(avg_fps, 2)}), indicating variable frame pacing or dropped capture frames."
                            ),
                            alternative_explanation=(
                                "Smartphone cameras, screen recorders, and web streaming encoders dynamically adjust "
                                "frame rate to balance thermal throttling, sensor exposure, and bitrate."
                            ),
                            evidence_strength=Strength.informational,
                            limitations=(
                                "Variable frame rate is characteristic of modern mobile capture and video conferencing streams; "
                                "it does not signify splicing or manipulation."
                            ),
                            details={"avg_fps": avg_fps, "r_fps": r_fps}
                        )
                    )

            elif codec_type == "audio" and not meta["audio_codec"]:
                meta["audio_codec"] = s.get("codec_name")

    except Exception as e:
        meta["error"] = str(e)

    return observations, claims, meta
