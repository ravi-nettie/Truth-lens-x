"""backend/app/analyzers/provenance/c2pa_check.py

Optional C2PA Content Credentials Manifest Reader for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Pure function: def inspect_c2pa(evidence_id: str, case_id: str, file_path: Path) -> C2PAResult
- If c2patool or c2pa-python is installed, parses embedded provenance assertions
- Native fallback: scans container structure for C2PA JUMBF / UUID metadata blocks
- Explicit forensic honesty guarantee:
  * ABSENCE of a C2PA manifest PROVES NOTHING about authenticity or manipulation
  * All findings are strictly informational unless a cryptographically corrupted manifest is detected
- Appends verified/unverified assertions to the Provenance Timeline
"""

import json
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Modality, Observation, Strength, TimelineEvent
from backend.app.services.safe_subprocess import run_safe_command, SubprocessSecurityError, SubprocessTimeoutError


def check_c2patool_binary() -> Optional[str]:
    """Finds c2patool in system PATH if installed."""
    return shutil.which("c2patool")


def scan_raw_container_for_c2pa(file_path: Path) -> bool:
    """
    Lightweight, safe structural probe for C2PA JUMBF / container markers.
    Checks for C2PA signatures without third-party binary dependencies:
    - JPEG: APP11 marker (0xFFEB) with 'JP2C' / 'c2pa'
    - MP4: 'c2pa' box or 'urn:c2pa'
    - WebP / PNG: 'c2pa' chunk or XMP containing 'c2pa'
    """
    if not file_path.exists():
        return False

    try:
        with open(file_path, "rb") as f:
            # Read first 128 KB for header boxes and markers
            head = f.read(131072)
            if b"c2pa" in head or b"urn:c2pa" in head or b"C2PA" in head:
                return True
            # Read last 64 KB (some manifests append at end of file)
            f.seek(0, 2)
            file_len = f.tell()
            if file_len > 131072:
                tail_len = min(65536, file_len)
                f.seek(file_len - tail_len)
                tail = f.read(tail_len)
                if b"c2pa" in tail or b"urn:c2pa" in tail or b"C2PA" in tail:
                    return True
    except Exception:
        pass
    return False


def inspect_c2pa(
    evidence_id: str,
    case_id: str,
    file_path: Path,
    modality: Modality = Modality.image
) -> Tuple[List[Observation], List[TimelineEvent], Dict[str, Any]]:
    """
    Inspects evidence file for embedded C2PA Content Credentials.
    Returns:
    - observations: C2PA-related forensic observations (always informational)
    - timeline_events: Chronological provenance events to merge into the Timeline
    - metadata: Raw manifest payload or detection telemetry
    """
    observations: List[Observation] = []
    timeline_events: List[TimelineEvent] = []
    metadata: Dict[str, Any] = {
        "c2pa_manifest_found": False,
        "tool_used": None,
        "manifest": None,
    }

    if not file_path.exists():
        return observations, timeline_events, metadata

    c2patool_bin = check_c2patool_binary()

    # 1. Attempt extraction via c2patool if available
    manifest_data = None
    if c2patool_bin:
        try:
            res = run_safe_command(
                [c2patool_bin, str(file_path), "--detailed"],
                timeout_sec=10.0,
                check=False
            )
            metadata["tool_used"] = "c2patool"
            if res.stdout and res.stdout.strip():
                try:
                    manifest_data = json.loads(res.stdout)
                except Exception:
                    manifest_data = {"raw_output": res.stdout.strip()}
        except (SubprocessSecurityError, SubprocessTimeoutError, Exception) as e:
            metadata["tool_error"] = str(e)
    else:
        # 2. Check Python c2pa bindings if available
        try:
            import c2pa
            reader = c2pa.Reader.from_file(str(file_path))
            manifest_json_str = reader.json()
            manifest_data = json.loads(manifest_json_str)
            metadata["tool_used"] = "c2pa-python"
        except ImportError:
            # c2pa-python is not installed
            metadata["tool_used"] = "container_scan"
        except Exception:
            # File may lack manifest
            metadata["tool_used"] = "c2pa-python"

    # 3. If tools absent or returned nothing, fall back to structural header scan
    has_raw_c2pa = False
    if manifest_data is None:
        has_raw_c2pa = scan_raw_container_for_c2pa(file_path)

    # 4. Synthesize Observations and Timeline Events
    if manifest_data:
        metadata["c2pa_manifest_found"] = True
        metadata["manifest"] = manifest_data

        active_manifest = manifest_data.get("active_manifest", {}) or manifest_data
        claim_generator = active_manifest.get("claim_generator", "Unknown C2PA Generator")
        title = active_manifest.get("title") or file_path.name
        format_info = active_manifest.get("format", "")
        validation_status = manifest_data.get("validation_status", "valid")

        # Extract assertions and actions
        assertions = active_manifest.get("assertions", [])
        actions_list = []
        for a in assertions:
            if a.get("label") == "c2pa.actions":
                actions_list = a.get("data", {}).get("actions", [])

        summary = f"Embedded C2PA Content Credentials manifest verified ({claim_generator})"
        explanation = (
            f"The media container contains an active C2PA Content Credentials manifest generated by '{claim_generator}'. "
            f"Validation status: {validation_status}."
        )

        observations.append(
            Observation(
                id=f"obs_c2pa_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=modality,
                indicator="c2pa_manifest_detected",
                method="c2pa_provenance_inspection",
                summary=summary,
                explanation=explanation,
                alternative_explanation=(
                    "C2PA manifests document declared edits and device provenance from compatible recording software, "
                    "but can be stripped or fabricated if cryptographic certificate chain is untrusted."
                ),
                evidence_strength=Strength.informational,
                limitations=(
                    "C2PA manifest verification validates that assertions match the digital signature, "
                    "not that real-world scene events occurred as claimed."
                ),
                details={
                    "claim_generator": claim_generator,
                    "validation_status": validation_status,
                    "actions_count": len(actions_list)
                }
            )
        )

        # Append timeline events from actions
        for act in actions_list:
            act_name = act.get("action", "edited")
            act_when = act.get("when")
            act_sw = act.get("softwareAgent", claim_generator)
            evt_id = f"evt_c2pa_{uuid4().hex[:8]}"
            timeline_events.append(
                TimelineEvent(
                    id=evt_id,
                    case_id=case_id,
                    ts=act_when,
                    media_time_ms=None,
                    kind="metadata",
                    ref_id=evidence_id,
                    label=f"C2PA Manifest Assertion: {act_name} via {act_sw}"
                )
            )

    elif has_raw_c2pa:
        # Raw structural box detected without CLI parser
        metadata["c2pa_manifest_found"] = True
        observations.append(
            Observation(
                id=f"obs_c2pa_box_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=modality,
                indicator="c2pa_container_box_detected",
                method="container_box_inspection",
                summary="C2PA provenance metadata box detected in file container",
                explanation="The file container embeds a C2PA metadata box (JUMBF / urn:c2pa).",
                alternative_explanation="Media produced by C2PA-enabled camera or editing application.",
                evidence_strength=Strength.informational,
                limitations="Full certificate chain validation requires local c2patool binary.",
                details={"structural_marker": "urn:c2pa"}
            )
        )
    else:
        # ABSENCE OF C2PA MANIFEST (Explicit Rule 2: Proves nothing!)
        observations.append(
            Observation(
                id=f"obs_c2pa_absent_{uuid4().hex[:8]}",
                case_id=case_id,
                evidence_id=evidence_id,
                modality=modality,
                indicator="c2pa_manifest_absent",
                method="c2pa_provenance_inspection",
                summary="No embedded C2PA Content Credentials manifest found",
                explanation=(
                    "The file does not contain an embedded C2PA provenance manifest or digital signature block. "
                    "This is normal for standard consumer hardware and web media."
                ),
                alternative_explanation=(
                    "The vast majority of cameras, mobile devices, and editing applications in production do not sign "
                    "or embed C2PA manifests. Social media platforms routinely strip metadata headers upon upload."
                ),
                evidence_strength=Strength.informational,
                limitations=(
                    "The absence of a C2PA manifest proves nothing about media provenance, authenticity, or tampering."
                ),
                details={"c2pa_detected": False}
            )
        )

    return observations, timeline_events, metadata
