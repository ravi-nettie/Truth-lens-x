"""backend/app/reporting/build_json.py

Forensic Report JSON Builder for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Local-first, offline execution
- Forensic Honesty: No fake probability score; triage review_priority with explicit formula
- Direct compilation strictly from SQLite database rows so the report matches exactly what the human reviewer saw
- Re-verifies SHA-256 of all active evidence before compiling and logs to audit_log
- Computes deterministic report_json_sha256 over canonical JSON
"""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.app.config import settings
from backend.app.correlation.strength import FORMULA_EXPLANATION
from backend.app.db import get_db
from backend.app.services.audit import append_audit, canonicalize_json, verify_audit_chain


DISCLAIMER_TEXT = (
    "Decision-Support Report — Not a Forensic Verdict or Proof of Authenticity/Manipulation"
)
CUSTODY_NOTE_TEXT = (
    "Provenance-aware audit trail; not legal chain-of-custody"
)
TOOL_VERSION = "1.0.0"

STRENGTH_RANK = {
    "strong": 0,
    "moderate": 1,
    "weak": 2,
    "informational": 3
}


def _human_size(size_bytes: int) -> str:
    """Formats raw bytes into a human-readable size string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0 or unit == "GB":
            return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{size_bytes} B"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} GB"


def _verify_evidence_sha256(ev: Dict[str, Any], conn) -> Dict[str, Any]:
    """
    Recomputes SHA-256 from disk, compares with stored hash,
    and appends an audit log entry.
    """
    evidence_id = ev["id"]
    case_id = ev["case_id"]
    stored_sha256 = ev["sha256"]
    stored_path_str = ev["stored_path"]

    file_path = Path(stored_path_str)
    if not file_path.is_absolute():
        file_path = (settings.data_path.parent / file_path).resolve()

    if not file_path.exists():
        actual_sha256 = "FILE_MISSING_ON_DISK"
        match = False
    else:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                hasher.update(chunk)
        actual_sha256 = hasher.hexdigest()
        match = (actual_sha256 == stored_sha256)

    append_audit(
        case_id=case_id,
        actor="system",
        action="VERIFY_HASH",
        target=evidence_id,
        details={
            "evidence_id": evidence_id,
            "expected_sha256": stored_sha256,
            "actual_sha256": actual_sha256,
            "match": match,
            "context": "pre_report_verification"
        },
        conn=conn
    )

    return {
        "status": "PASS" if match else "FAIL",
        "expected_sha256": stored_sha256,
        "actual_sha256": actual_sha256,
        "match": match
    }


def _extract_media_metadata(ev: Dict[str, Any], observations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extracts media metadata fields with clear source attribution."""
    kind = ev.get("kind", "").lower()
    ev_id = ev.get("id")
    filename = ev.get("original_name")
    stored_path_str = ev.get("stored_path")

    meta: Dict[str, Any] = {
        "evidence_id": ev_id,
        "filename": filename,
        "kind": kind,
        "source_attribution": "",
        "attributes": {}
    }

    # Pull metadata from observations if available
    obs_for_ev = [o for o in observations if o.get("evidence_id") == ev_id]

    if kind in ("image", "photo"):
        meta["source_attribution"] = f"EXIF and container header inspection of '{filename}'"
        attrs: Dict[str, Any] = {}
        # Try extracting directly from disk if possible
        if stored_path_str:
            p = Path(stored_path_str)
            if not p.is_absolute():
                p = (settings.data_path.parent / p).resolve()
            if p.exists():
                try:
                    from backend.app.analyzers.image.exif import extract_exif_metadata
                    exif_data = extract_exif_metadata(p)
                    for k in ("make", "model", "software", "datetime_original", "modify_date", "has_gps", "gps_coords"):
                        if exif_data.get(k):
                            attrs[k] = exif_data[k]
                except Exception:
                    pass
        # Augment with observation details
        for o in obs_for_ev:
            try:
                det = json.loads(o.get("details_json") or "{}")
                if "software_tag" in det:
                    attrs["software_tag"] = det["software_tag"]
            except Exception:
                pass
        meta["attributes"] = attrs

    elif kind in ("video", "clip"):
        meta["source_attribution"] = f"ffprobe stream and container analysis of '{filename}'"
        attrs = {}
        for o in obs_for_ev:
            try:
                det = json.loads(o.get("details_json") or "{}")
                for k in ("duration_sec", "video_codec", "audio_codec", "width", "height", "fps", "creation_time"):
                    if k in det and det[k] is not None:
                        attrs[k] = det[k]
            except Exception:
                pass
        meta["attributes"] = attrs

    elif kind in ("audio", "recording"):
        meta["source_attribution"] = f"Audio waveform and spectral analysis of '{filename}'"
        attrs = {}
        for o in obs_for_ev:
            try:
                det = json.loads(o.get("details_json") or "{}")
                for k in ("sample_rate", "duration_sec", "channels"):
                    if k in det and det[k] is not None:
                        attrs[k] = det[k]
            except Exception:
                pass
        meta["attributes"] = attrs

    elif kind in ("text", "caption"):
        meta["source_attribution"] = f"User caption claim input for '{filename}'"
        source_note = ev.get("source_note") or ""
        meta["attributes"] = {
            "character_count": len(source_note),
            "word_count": len(source_note.split()) if source_note else 0
        }

    return meta


def build_report_json(case_id: str, report_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Compiles a deterministic forensic report dictionary directly from SQLite.
    Saves JSON artifact to data/artifacts/<case_id>/reports/<report_id>.json.
    """
    report_id = report_id or f"rep_{uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Fetch Case
        cursor.execute("SELECT * FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        if not case_row:
            raise ValueError(f"Case '{case_id}' not found.")
        case_data = dict(case_row)

        # 2. Fetch Active Evidence & Pre-Verification SHA-256
        cursor.execute(
            "SELECT * FROM evidence WHERE case_id = ? AND deleted_at IS NULL ORDER BY uploaded_at ASC",
            (case_id,)
        )
        evidence_rows = [dict(r) for r in cursor.fetchall()]

        evidence_table = []
        for ev in evidence_rows:
            verif = _verify_evidence_sha256(ev, conn)
            evidence_table.append({
                "id": ev["id"],
                "original_name": ev["original_name"],
                "kind": ev["kind"],
                "size_bytes": ev["size_bytes"],
                "size_human": _human_size(ev["size_bytes"]),
                "sha256": ev["sha256"],
                "uploaded_at": ev["uploaded_at"],
                "verification_status": verif["status"],
                "verification_match": verif["match"],
                "actual_sha256": verif["actual_sha256"],
                "source_note": ev.get("source_note") or ""
            })

        # 3. Fetch Analysis Runs
        cursor.execute(
            """
            SELECT ar.* FROM analysis_runs ar
            JOIN evidence e ON ar.evidence_id = e.id
            WHERE e.case_id = ? AND e.deleted_at IS NULL
            ORDER BY ar.started_at ASC
            """,
            (case_id,)
        )
        run_rows = [dict(r) for r in cursor.fetchall()]

        methods_used = []
        for r in run_rows:
            params = {}
            if r.get("params_json"):
                try:
                    params = json.loads(r["params_json"])
                except Exception:
                    params = {"raw": r["params_json"]}
            methods_used.append({
                "id": r["id"],
                "evidence_id": r["evidence_id"],
                "analyzer": r["analyzer"],
                "tool_version": r["tool_version"],
                "parameters": params,
                "status": r["status"],
                "error": r.get("error") or "",
                "started_at": r["started_at"],
                "finished_at": r.get("finished_at") or ""
            })

        # 4. Fetch Observations & Artifacts
        cursor.execute("SELECT * FROM observations WHERE case_id = ?", (case_id,))
        obs_rows = [dict(r) for r in cursor.fetchall()]

        cursor.execute("SELECT * FROM artifacts WHERE case_id = ?", (case_id,))
        artifacts_rows = [dict(r) for r in cursor.fetchall()]

        # 5. Fetch Review Decisions
        cursor.execute("SELECT * FROM review_decisions WHERE case_id = ? ORDER BY decided_at ASC", (case_id,))
        rev_rows = [dict(r) for r in cursor.fetchall()]

        # Map observation ID to latest review decision
        latest_reviews: Dict[str, Dict[str, Any]] = {}
        for rev in rev_rows:
            target_id = rev.get("target_id")
            if target_id:
                latest_reviews[target_id] = rev

        # 6. Fetch Claims
        cursor.execute("SELECT * FROM claims WHERE case_id = ?", (case_id,))
        claim_rows = [dict(r) for r in cursor.fetchall()]

        # 7. Fetch Graph Edges
        cursor.execute("SELECT * FROM graph_edges WHERE case_id = ?", (case_id,))
        edge_rows = [dict(r) for r in cursor.fetchall()]

        cross_modal_relationships = []
        for edge in edge_rows:
            obs_ids = []
            if edge.get("evidence_observation_ids_json"):
                try:
                    obs_ids = json.loads(edge["evidence_observation_ids_json"])
                except Exception:
                    obs_ids = [edge["evidence_observation_ids_json"]]
            cross_modal_relationships.append({
                "id": edge["id"],
                "relation": edge["relation"],
                "rule": edge["rule"],
                "src_id": edge["src_id"],
                "dst_id": edge["dst_id"],
                "evidence_observation_ids": obs_ids,
                "explanation": edge["explanation"],
                "alternative_explanation": edge["alternative_explanation"],
                "strength": edge["strength"]
            })

        # 8. Fetch Timeline Events & Map Original Names
        cursor.execute(
            "SELECT * FROM timeline_events WHERE case_id = ? ORDER BY ts ASC, id ASC",
            (case_id,)
        )
        timeline_rows = [dict(r) for r in cursor.fetchall()]

        ev_name_lookup = {ev["id"]: ev.get("original_name") for ev in evidence_rows}

        timeline = []
        for te in timeline_rows:
            ref_id = te.get("ref_id")
            orig_n = ev_name_lookup.get(ref_id)
            lbl = te.get("label", "")
            if orig_n and orig_n not in lbl:
                lbl = f"{lbl} (File: {orig_n})"
            timeline.append({
                "id": te["id"],
                "ts": te.get("ts") or "",
                "media_time_ms": te.get("media_time_ms"),
                "kind": te["kind"],
                "ref_id": ref_id,
                "original_name": orig_n,
                "label": lbl
            })

        # 9. Format Findings (sorted by strength: strong -> moderate -> weak -> informational)
        sorted_obs = sorted(
            obs_rows,
            key=lambda o: (STRENGTH_RANK.get(str(o.get("evidence_strength", "")).lower(), 99), o.get("id"))
        )

        findings = []
        strength_counts = {"strong": 0, "moderate": 0, "weak": 0, "informational": 0}
        review_status_counts = {"unreviewed": 0, "confirmed": 0, "dismissed": 0, "needs_more_work": 0}

        for o in sorted_obs:
            str_key = str(o.get("evidence_strength", "informational")).lower()
            if str_key in strength_counts:
                strength_counts[str_key] += 1
            else:
                strength_counts["informational"] += 1

            obs_id = o["id"]
            rev = latest_reviews.get(obs_id)

            if not rev:
                rev_status = "unreviewed"
                rev_note = ""
                reviewer = ""
            else:
                dec = str(rev.get("decision", "")).lower()
                rev_note = rev.get("note") or ""
                reviewer = rev.get("reviewer") or ""
                if dec == "confirmed":
                    rev_status = "confirmed"
                elif dec == "dismissed":
                    rev_status = "dismissed"
                else:
                    rev_status = "needs_more_work"

            if rev_status in review_status_counts:
                review_status_counts[rev_status] += 1
            else:
                review_status_counts["needs_more_work"] += 1

            # Region or timestamp display
            region_str = ""
            if o.get("region_json"):
                try:
                    reg = json.loads(o["region_json"])
                    region_str = f"x={reg.get('x')}, y={reg.get('y')}, w={reg.get('w')}, h={reg.get('h')}"
                    if reg.get("frame_index") is not None:
                        region_str += f" (frame {reg.get('frame_index')})"
                except Exception:
                    region_str = str(o["region_json"])

            time_str = ""
            if o.get("time_start_ms") is not None and o.get("time_end_ms") is not None:
                time_str = f"{o['time_start_ms']}ms - {o['time_end_ms']}ms"

            loc_str = region_str or time_str or "N/A"

            model_score = o.get("model_score")
            model_score_display = (
                f"{model_score:.3f} (uncalibrated model output)"
                if model_score is not None
                else None
            )

            art_ids = []
            if o.get("artifact_ids_json"):
                try:
                    art_ids = json.loads(o["artifact_ids_json"])
                except Exception:
                    art_ids = [o["artifact_ids_json"]]

            det_obj = {}
            if o.get("details_json"):
                try:
                    det_obj = json.loads(o["details_json"])
                except Exception:
                    det_obj = {"raw": o["details_json"]}

            findings.append({
                "id": obs_id,
                "evidence_id": o["evidence_id"],
                "run_id": o.get("run_id"),
                "modality": o["modality"],
                "indicator": o["indicator"],
                "method": o["method"],
                "summary": o["summary"],
                "explanation": o["explanation"],
                "alternative_explanation": o["alternative_explanation"],
                "evidence_strength": o["evidence_strength"],
                "region_or_timestamp": loc_str,
                "model_score": model_score,
                "model_score_display": model_score_display,
                "model_calibrated": bool(o.get("model_calibrated", 0)),
                "model_name": o.get("model_name"),
                "artifact_ids": art_ids,
                "details": det_obj,
                "limitations": o.get("limitations") or "",
                "human_review_status": rev_status,
                "latest_reviewer_note": rev_note,
                "latest_reviewer": reviewer
            })

        # 10. Analyzer Coverage Matrix & Audit
        # Map expected analyzers based on evidence kinds in this case
        active_modalities = set(ev["kind"].lower() for ev in evidence_rows)
        expected_analyzers: List[Dict[str, str]] = []
        for ev in evidence_rows:
            k = ev["kind"].lower()
            ev_id = ev["id"]
            if k in ("image", "photo"):
                expected_analyzers.append({"evidence_id": ev_id, "analyzer": "image_forensics", "modality": "image"})
                if settings.ENABLE_AI_ORIGIN_CLASSIFIER:
                    expected_analyzers.append({"evidence_id": ev_id, "analyzer": "ai_origin", "modality": "image"})
            elif k in ("video", "clip"):
                expected_analyzers.append({"evidence_id": ev_id, "analyzer": "video_analysis", "modality": "video"})
            elif k in ("audio", "recording"):
                expected_analyzers.append({"evidence_id": ev_id, "analyzer": "audio_analysis", "modality": "audio"})
            elif k in ("text", "caption"):
                expected_analyzers.append({"evidence_id": ev_id, "analyzer": "text_analysis", "modality": "text"})

        # Cross-reference with executed analysis runs
        run_lookup = {}
        for r in methods_used:
            key = (r["evidence_id"], r["analyzer"])
            run_lookup[key] = r

        coverage_items = []
        skipped_or_failed = []
        completed_count = 0

        for exp in expected_analyzers:
            match = run_lookup.get((exp["evidence_id"], exp["analyzer"]))
            if match:
                st = match["status"]
                err = match["error"]
                if st == "done":
                    completed_count += 1
                    status_label = "COMPLETED"
                elif "skipped" in st:
                    status_label = f"SKIPPED ({err or 'Missing Model/Config'})"
                    skipped_or_failed.append({"analyzer": exp["analyzer"], "evidence_id": exp["evidence_id"], "reason": err or "Skipped"})
                else:
                    status_label = f"FAILED ({err or 'Execution error'})"
                    skipped_or_failed.append({"analyzer": exp["analyzer"], "evidence_id": exp["evidence_id"], "reason": err or "Failed"})
            else:
                status_label = "NOT_EXECUTED"
                skipped_or_failed.append({"analyzer": exp["analyzer"], "evidence_id": exp["evidence_id"], "reason": "Not executed"})

            coverage_items.append({
                "evidence_id": exp["evidence_id"],
                "analyzer": exp["analyzer"],
                "modality": exp["modality"],
                "status": status_label
            })

        total_expected = len(expected_analyzers)
        coverage_pct = round((completed_count / max(1, total_expected)) * 100.0, 1) if total_expected > 0 else 100.0
        coverage_complete = (len(skipped_or_failed) == 0)

        analyzer_coverage = {
            "total_expected": total_expected,
            "completed": completed_count,
            "skipped_or_failed_count": len(skipped_or_failed),
            "coverage_percentage": coverage_pct,
            "coverage_complete": coverage_complete,
            "skipped_or_failed_modules": skipped_or_failed,
            "items": coverage_items
        }

        # 11. AI-Origin Classifier Status & Model Provenance
        ai_obs = [o for o in obs_rows if o.get("indicator") == "ai_origin_classification"]
        ai_runs = [r for r in methods_used if r.get("analyzer") in ("ai_origin", "ai_origin_detector")]
        weights_exist = (settings.ai_image_detector_dir / "model.safetensors").exists() or (settings.ai_image_detector_dir / "pytorch_model.bin").exists()

        if "image" not in active_modalities and "photo" not in active_modalities:
            ai_status = "NOT_APPLICABLE"
            ai_desc = "No image evidence registered in case."
        elif not settings.ENABLE_AI_ORIGIN_CLASSIFIER:
            ai_status = "DISABLED"
            ai_desc = "AI-origin classifier disabled in configuration (ENABLE_AI_ORIGIN_CLASSIFIER=false)."
        elif not weights_exist and not ai_runs:
            ai_status = "SKIPPED_MISSING_MODEL"
            ai_desc = "Local model weights not found in models/ai_image_detector/."
        elif ai_runs and any(r.get("status") == "skipped_missing_model" for r in ai_runs):
            ai_status = "SKIPPED_MISSING_MODEL"
            ai_desc = "AI-origin classifier skipped: offline weights not present locally."
        elif ai_runs and any(r.get("status") == "done" for r in ai_runs):
            ai_status = "LOADED_AND_EXECUTED"
            ai_desc = "Pretrained classifier loaded from local weights and executed offline on CPU."
        else:
            ai_status = "READY"
            ai_desc = "Weights present; awaiting execution."

        ai_origin_provenance = {
            "status": ai_status,
            "description": ai_desc,
            "model_id": settings.AI_IMAGE_MODEL_ID,
            "model_weights_path": str(settings.ai_image_detector_dir),
            "model_calibrated": False,
            "calibration_disclaimer": (
                "UNCALIBRATED DEEP LEARNING CLASSIFIER OUTPUT: Softmax probability scores reflect raw model logits "
                "from synthetic training distributions (SDXL/Diffusion). Scores are NOT calibrated against real-world "
                "sensor noise or social media recompression. Must NEVER be cited as standalone forensic proof of AI origin."
            ),
            "observations_count": len(ai_obs)
        }

        # 12. Compute Case Summary & Priority
        # Forensic Rule: Prevent LOW review priority from implying successful verification when required analyzers did not run!
        contradiction_count = sum(1 for e in cross_modal_relationships if e["relation"] == "CONTRADICTS")
        if strength_counts["strong"] >= 1 or (strength_counts["moderate"] >= 2 and contradiction_count >= 1):
            review_priority = "high"
            priority_label = "HIGH PRIORITY (Strong Forensic Indicators Present)"
            coverage_warning = ""
        elif strength_counts["moderate"] >= 1 or contradiction_count >= 1:
            review_priority = "medium"
            priority_label = "MEDIUM PRIORITY (Moderate Indicators or Contradictions Present)"
            coverage_warning = ""
        elif not coverage_complete:
            # Crucial: Incomplete analyzer coverage cannot default to LOW!
            review_priority = "medium"
            priority_label = f"MEDIUM PRIORITY (INCOMPLETE COVERAGE — {len(skipped_or_failed)} module(s) skipped/failed)"
            coverage_warning = (
                f"WARNING: Low risk cannot be inferred. {len(skipped_or_failed)} expected analyzer module(s) were "
                f"skipped or failed ({', '.join(m['analyzer'] for m in skipped_or_failed)}). "
                f"Potential manipulations in unanalyzed modalities remain unassessed."
            )
        else:
            review_priority = "low"
            priority_label = "LOW PRIORITY (No suspicious indicators detected across full analyzer suite)"
            coverage_warning = ""

        case_summary = {
            "review_priority": review_priority,
            "review_priority_label": priority_label,
            "review_priority_formula": FORMULA_EXPLANATION,
            "coverage_warning": coverage_warning,
            "strength_counts": strength_counts,
            "review_status_counts": review_status_counts,
            "total_findings": len(findings),
            "unreviewed_count": review_status_counts["unreviewed"],
            "analyzer_coverage": analyzer_coverage,
            "ai_origin_status": ai_origin_provenance
        }

        # 13. Media Metadata
        media_metadata = [_extract_media_metadata(ev, obs_rows) for ev in evidence_rows]

        # 14. Limitations & Alternative Explanations
        limitations_and_alternatives = {
            "per_modality_risks": {
                "image": (
                    "Image compression artifacts, social media re-compression, Error Level Analysis (ELA) "
                    "contrast boundary noise, and natural repetitive patterns (foliage, architectural windows) "
                    "routinely cause false-positive detections. ELA is strictly non-applicable to PNG/lossless formats. "
                    "Missing EXIF metadata is standard across messaging platforms."
                ),
                "video": (
                    "Video inter-frame temporal compression (GOP boundaries, P/B macroblock artifacts), variable frame "
                    "rates, editorial cut transitions (dissolves, hard splices), and playback clock jitter can simulate "
                    "tampering patterns without malicious synthesis."
                ),
                "audio": (
                    "Microphone clipping, environmental background acoustics, acoustic reverberation shifts, VoIP packet loss, "
                    "and dynamic range compression frequently create spectral discontinuities indistinguishable from splices."
                ),
                "text": (
                    "Textual captions frequently reflect informal estimation, colloquial number rounding, differing observation "
                    "vantage points, or minor typographical variations rather than intentional falsification."
                )
            },
            "uncertainty_categories": {
                "measurement": "Sensor noise, optical aberration, quantization noise, and lossy codec decimation inherent in digital capture.",
                "model": "Heuristic thresholds, statistical clustering, and uncalibrated deep learning weights trained on synthetic distributions.",
                "interpretation": "Human confirmation bias and the inability to discern benign editorial intent (creative grading, cropping) from falsification.",
                "coverage": "Absence of continuous multi-angle capture, missing raw camera sensor outputs, and lack of ground-truth timestamp beacons.",
                "transcription": "Automated speech recognition (ASR) phonetic confusions, background chatter overlap, and acoustic degradation."
            }
        }

        # 15. Dynamic Recommendations for Human Review (Tailored to actual analyzed modalities and findings)
        recs = []
        if "image" in active_modalities or "photo" in active_modalities:
            cm_obs = [f for f in findings if f.get("indicator") == "copy_move_duplication"]
            if cm_obs:
                recs.append(
                    "Inspect copy-move visual overlay artifact and verify Cluster A vs Cluster B coordinates in "
                    "uncompressed original to eliminate repetitive architectural/physical textures."
                )
            ela_non_jpeg = [f for f in findings if "Non-JPEG" in f.get("summary", "")]
            if ela_non_jpeg:
                recs.append(
                    "Note that ELA is non-applicable on PNG/lossless containers; request original camera capture (.CR2/JPEG) if available."
                )
            exif_ed = [f for f in findings if f.get("indicator") == "exif_editor_detected"]
            if exif_ed:
                recs.append(
                    "Examine EXIF software editing tag and modification timestamp against the claimed event chronology."
                )
            if ai_obs:
                recs.append(
                    "Verify AI-origin classification score against high-magnification sensor noise, edge coherency, and photorealistic rendering consistency."
                )

        if "video" in active_modalities or "clip" in active_modalities:
            recs.append(
                "Inspect high-resolution video keyframes around detected scene cut timestamps for visual and lighting continuity."
            )

        if "audio" in active_modalities or "recording" in active_modalities:
            recs.append(
                "Listen with professional monitoring headphones at flagged audio timestamps around detected spectral discontinuities."
            )

        if "text" in active_modalities or "caption" in active_modalities:
            recs.append(
                "Cross-reference transcribed quantities, dates, and numerical claims against authoritative public registries or aerial records."
            )

        if not coverage_complete:
            recs.append(
                f"Resolve analyzer coverage gaps: download missing model weights or re-run skipped analyzers "
                f"({', '.join(m['analyzer'] for m in skipped_or_failed)}) before making final determinations."
            )

        recs.append(
            "Request primary camera raw container files (.CR2, .NEF, .WAV, uncompressed MP4) whenever possible to eliminate transcoding artifacts."
        )

        human_review_recommendations = recs

        # 16. Audit Excerpt & Verification (Clearly labeled as internal audit log integrity only)
        audit_res = verify_audit_chain(case_id, conn=conn)

        cursor.execute(
            "SELECT id, ts, actor, action, target, prev_hash, entry_hash FROM audit_log WHERE case_id = ? ORDER BY id ASC",
            (case_id,)
        )
        audit_rows = [dict(r) for r in cursor.fetchall()]

        audit_excerpt = {
            "internal_audit_chain_valid": audit_res["valid"],
            "internal_audit_only": True,
            "chain_scope_note": (
                "Verifies internal SQLite database audit log integrity and hash-chaining sequence since ingestion. "
                "Does NOT prove external origin authenticity, camera hardware signatures, or independent cryptographic provenance."
            ),
            "audit_count": audit_res["count"],
            "verification_errors": audit_res["errors"],
            "entries": audit_rows
        }

        # 17. Report Meta & Fingerprint Scope
        report_meta = {
            "report_id": report_id,
            "case_id": case_id,
            "case_title": case_data["title"],
            "case_status": case_data["status"],
            "generated_at": now_iso,
            "tool_version": TOOL_VERSION,
            "disclaimer": DISCLAIMER_TEXT,
            "custody_note": CUSTODY_NOTE_TEXT,
            "fingerprint_scope": {
                "protects": "Integrity of this compiled report document against post-generation alteration of findings or metadata.",
                "does_not_protect": "Authenticity of the underlying media, real-world factual claims, or external provenance."
            }
        }

        # Assemble full report payload before hashing
        report_payload = {
            "report_meta": report_meta,
            "case_summary": case_summary,
            "evidence_table": evidence_table,
            "media_metadata": media_metadata,
            "methods_used": methods_used,
            "findings": findings,
            "cross_modal_relationships": cross_modal_relationships,
            "timeline": timeline,
            "limitations_and_alternatives": limitations_and_alternatives,
            "human_review_recommendations": human_review_recommendations,
            "audit_excerpt": audit_excerpt,
            "artifacts": artifacts_rows
        }

        # Compute deterministic canonical JSON SHA-256
        canonical_bytes = canonicalize_json(report_payload).encode("utf-8")
        report_json_sha256 = hashlib.sha256(canonical_bytes).hexdigest()

        report_payload["report_json_sha256"] = report_json_sha256

        # Save JSON to data/artifacts/<case_id>/reports/<report_id>.json
        reports_dir = settings.artifacts_dir / case_id / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        json_path = reports_dir / f"{report_id}.json"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report_payload, f, indent=2, ensure_ascii=False)

        return report_payload

