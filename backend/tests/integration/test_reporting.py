"""backend/tests/integration/test_reporting.py

Integration test suite for the Forensic Report Engine (Phase 7).
Tests:
- Populates an end-to-end case in SQLite with evidence, analysis runs, observations across all strengths,
  claims, graph edges, timeline events, review decisions, and hash-chained audit log.
- Triggers POST /api/cases/{case_id}/report.
- Asserts transition to 'reported' state and audit logging.
- Validates canonical JSON structure, field completeness, and report_json_sha256 cryptographic match.
- Verifies generated PDF opens cleanly with pypdf and contains:
  - All 11 required sections in exact order
  - Prominent 'DECISION-SUPPORT ONLY — NOT A VERDICT' banner
  - Unreviewed findings count
  - Correctly escaped user strings (<script>&)
  - Full report_json_sha256 hash
- Tests GET /api/reports/{id}.pdf and GET /api/reports/{id}.json streaming endpoints.
"""

from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader

from backend.app.config import settings
from backend.app.correlation.strength import FORMULA_EXPLANATION
from backend.app.db import get_db, init_db
from backend.app.main import app
from backend.app.services.audit import append_audit, canonicalize_json


@pytest.fixture(scope="module")
def client():
    settings.ensure_dirs()
    init_db()
    with TestClient(app) as c:
        yield c


def _setup_populated_case(case_id: str):
    """Inserts a fully populated case into SQLite matching real investigation state."""
    now_ts = datetime.now(timezone.utc).isoformat()

    # 1. Physical test evidence files on disk
    case_ev_dir = settings.evidence_dir / case_id
    case_ev_dir.mkdir(parents=True, exist_ok=True)

    # Valid JPEG image
    img = Image.new("RGB", (100, 100), color=(50, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()
    img_sha256 = hashlib.sha256(img_bytes).hexdigest()
    img_path = case_ev_dir / f"{img_sha256}.jpg"
    img_path.write_bytes(img_bytes)

    # Caption text evidence with special characters
    caption_text = "Reported 25,000 attendees & VIPs <script>alert('xss')</script> at the main pavilion."
    cap_bytes = caption_text.encode("utf-8")
    cap_sha256 = hashlib.sha256(cap_bytes).hexdigest()
    cap_path = case_ev_dir / f"{cap_sha256}.txt"
    cap_path.write_bytes(cap_bytes)

    with get_db() as conn:
        cursor = conn.cursor()

        # Insert Case with special characters in title and notes
        cursor.execute(
            """
            INSERT OR REPLACE INTO cases (id, title, status, created_at, notes)
            VALUES (?, ?, 'correlated', ?, ?)
            """,
            (case_id, "Campus Demonstration & Rally <script>alert('test')</script>", now_ts, "Forensic intake note & summary")
        )

        # Audit GENESIS
        append_audit(
            case_id=case_id,
            actor="analyst",
            action="CREATE_CASE",
            target=case_id,
            details={"title": "Campus Demonstration"},
            conn=conn
        )

        # Insert Evidence Items
        ev1_id = f"ev_img_{uuid4().hex[:8]}"
        ev2_id = f"ev_cap_{uuid4().hex[:8]}"

        cursor.execute(
            """
            INSERT OR REPLACE INTO evidence
            (id, case_id, kind, original_name, stored_path, sha256, size_bytes, mime, uploaded_at, source_note, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            """,
            (ev1_id, case_id, "image", "rally_crowd_<special>&.jpg", str(img_path), img_sha256, len(img_bytes), "image/jpeg", now_ts, "Crowd sector photo")
        )
        append_audit(
            case_id=case_id,
            actor="analyst",
            action="INGEST_EVIDENCE",
            target=ev1_id,
            details={"sha256": img_sha256, "filename": "rally_crowd_<special>&.jpg"},
            conn=conn
        )

        cursor.execute(
            """
            INSERT OR REPLACE INTO evidence
            (id, case_id, kind, original_name, stored_path, sha256, size_bytes, mime, uploaded_at, source_note, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            """,
            (ev2_id, case_id, "caption", "caption_<xss>&.txt", str(cap_path), cap_sha256, len(cap_bytes), "text/plain", now_ts, caption_text)
        )
        append_audit(
            case_id=case_id,
            actor="analyst",
            action="INGEST_EVIDENCE",
            target=ev2_id,
            details={"sha256": cap_sha256, "filename": "caption_<xss>&.txt"},
            conn=conn
        )

        # Insert Analysis Runs
        run1_id = f"run_img_{uuid4().hex[:8]}"
        run2_id = f"run_aud_{uuid4().hex[:8]}"

        cursor.execute(
            """
            INSERT OR REPLACE INTO analysis_runs
            (id, evidence_id, analyzer, tool_version, params_json, status, error, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run1_id, ev1_id, "image_analyzer", "1.0.0", json.dumps({"max_dim": 2000}), "done", None, now_ts, now_ts)
        )
        cursor.execute(
            """
            INSERT OR REPLACE INTO analysis_runs
            (id, evidence_id, analyzer, tool_version, params_json, status, error, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run2_id, ev1_id, "audio_analyzer", "1.0.0", json.dumps({"model": "tiny.en"}), "skipped_missing_model", "Speech model weights not installed locally", now_ts, now_ts)
        )

        # Insert Observations across 4 strengths
        obs1_id = f"obs_strong_{uuid4().hex[:8]}"
        obs2_id = f"obs_mod_{uuid4().hex[:8]}"
        obs3_id = f"obs_weak_{uuid4().hex[:8]}"
        obs4_id = f"obs_info_{uuid4().hex[:8]}"

        # 1. Strong observation
        cursor.execute(
            """
            INSERT OR REPLACE INTO observations
            (id, case_id, evidence_id, run_id, modality, indicator, method, summary, explanation,
             alternative_explanation, evidence_strength, model_score, model_calibrated, model_name,
             region_json, time_start_ms, time_end_ms, artifact_ids_json, details_json, limitations)
            VALUES (?, ?, ?, ?, 'image', 'solar_shadow_contradiction', 'solar_geometry_analysis',
                    'Shadow vector contradicts solar azimuth <script>&check;',
                    'Shadow angles on the north tower deviate by 42 degrees from calculated solar position.',
                    'Nearby stadium floodlights or reflective glass architecture could introduce secondary cast shadows.',
                    'strong', 0.945, 0, 'ShadowNet-v2', '{\"x\": 10, \"y\": 20, \"w\": 150, \"h\": 120}',
                    NULL, NULL, '[]', '{}', 'Solar calculations depend on accurate GPS and local timezone assumptions.')
            """,
            (obs1_id, case_id, ev1_id, run1_id)
        )

        # 2. Moderate observation
        cursor.execute(
            """
            INSERT OR REPLACE INTO observations
            (id, case_id, evidence_id, run_id, modality, indicator, method, summary, explanation,
             alternative_explanation, evidence_strength, model_score, model_calibrated, model_name,
             region_json, time_start_ms, time_end_ms, artifact_ids_json, details_json, limitations)
            VALUES (?, ?, ?, ?, 'image', 'copy_move', 'spatial_correlation',
                    'Clustered duplicate keypoint match in crowd region',
                    'A 64x64 pixel patch appears duplicated across two distinct spatial regions.',
                    'Repetitive structural patterns such as festival fencing or fabric banners can match naturally.',
                    'moderate', 0.720, 0, 'CopyMoveDetector', '{\"x\": 50, \"y\": 60, \"w\": 64, \"h\": 64}',
                    NULL, NULL, '[]', '{}', 'Feature matching thresholds may trigger on high-frequency periodic textures.')
            """,
            (obs2_id, case_id, ev1_id, run1_id)
        )

        # 3. Weak observation
        cursor.execute(
            """
            INSERT OR REPLACE INTO observations
            (id, case_id, evidence_id, run_id, modality, indicator, method, summary, explanation,
             alternative_explanation, evidence_strength, model_score, model_calibrated, model_name,
             region_json, time_start_ms, time_end_ms, artifact_ids_json, details_json, limitations)
            VALUES (?, ?, ?, ?, 'image', 'jpeg_compression_discontinuity', 'quantization_table_analysis',
                    'Subtle block boundary quantization variance',
                    'Higher error residuals observed near central frame boundary.',
                    'Differential image complexity and flat sky areas naturally yield non-uniform JPEG residuals.',
                    'weak', NULL, 0, NULL, NULL, NULL, NULL, '[]', '{}', 'Single-quality quantization estimates carry high false-positive rates.')
            """,
            (obs3_id, case_id, ev1_id, run1_id)
        )

        # 4. Informational observation
        cursor.execute(
            """
            INSERT OR REPLACE INTO observations
            (id, case_id, evidence_id, run_id, modality, indicator, method, summary, explanation,
             alternative_explanation, evidence_strength, model_score, model_calibrated, model_name,
             region_json, time_start_ms, time_end_ms, artifact_ids_json, details_json, limitations)
            VALUES (?, ?, ?, ?, 'image', 'missing_exif', 'exif_metadata_inspection',
                    'No camera EXIF metadata detected in JPEG container',
                    'The file does not contain camera make, model, or exposure metadata.',
                    'Social media messaging platforms routinely strip EXIF metadata to protect user privacy.',
                    'informational', NULL, 0, NULL, NULL, NULL, NULL, '[]', '{}', 'Missing EXIF is standard on web media and does not indicate manipulation.')
            """,
            (obs4_id, case_id, ev1_id, run1_id)
        )

        # Claims
        claim_id = f"clm_{uuid4().hex[:8]}"
        cursor.execute(
            """
            INSERT OR REPLACE INTO claims
            (id, case_id, source_evidence_id, source_kind, text, claim_type, value_json, time_start_ms, time_end_ms)
            VALUES (?, ?, ?, 'caption', ?, 'numerical_turnout', '{\"count\": 25000}', NULL, NULL)
            """,
            (claim_id, case_id, ev2_id, caption_text)
        )

        # Graph Edges (contradiction)
        edge_id = f"edge_{uuid4().hex[:8]}"
        cursor.execute(
            """
            INSERT OR REPLACE INTO graph_edges
            (id, case_id, src_id, dst_id, relation, rule, evidence_observation_ids_json, explanation, alternative_explanation, strength)
            VALUES (?, ?, ?, ?, 'CONTRADICTS', 'R3_number_mismatch', ?,
                    'Caption turnout claim of 25,000 exceeds visible crowd capacity & space limits <script>&',
                    'Caption may describe cumulative event registration rather than instantaneous attendance.', 'moderate')
            """,
            (edge_id, case_id, claim_id, obs1_id, json.dumps([obs1_id, obs2_id]))
        )

        # Timeline Events
        evt1_id = f"evt_{uuid4().hex[:8]}"
        cursor.execute(
            """
            INSERT OR REPLACE INTO timeline_events (id, case_id, ts, media_time_ms, kind, ref_id, label)
            VALUES (?, ?, ?, NULL, 'evidence_upload', ?, 'Evidence uploaded: rally_crowd.jpg')
            """,
            (evt1_id, case_id, now_ts, ev1_id)
        )

        # Review Decisions:
        # Mark obs1 as confirmed, obs2 as dismissed, leave obs3 and obs4 unreviewed
        rev1_id = f"rev_{uuid4().hex[:8]}"
        rev2_id = f"rev_{uuid4().hex[:8]}"

        cursor.execute(
            """
            INSERT OR REPLACE INTO review_decisions
            (id, case_id, target_type, target_id, decision, note, reviewer, decided_at)
            VALUES (?, ?, 'observation', ?, 'confirmed', 'Forensic solar verification confirmed by senior analyst <script>&raw_data', 'lead_analyst', ?)
            """,
            (rev1_id, case_id, obs1_id, now_ts)
        )

        cursor.execute(
            """
            INSERT OR REPLACE INTO review_decisions
            (id, case_id, target_type, target_id, decision, note, reviewer, decided_at)
            VALUES (?, ?, 'observation', ?, 'dismissed', 'Benign repetitive architectural texture matches', 'lead_analyst', ?)
            """,
            (rev2_id, case_id, obs2_id, now_ts)
        )

        append_audit(
            case_id=case_id,
            actor="lead_analyst",
            action="REVIEW_DECISION",
            target=obs1_id,
            details={"decision": "confirmed", "note": "Solar verification confirmed"},
            conn=conn
        )


def test_reporting_engine_end_to_end(client: TestClient):
    """
    Comprehensive integration test verifying:
    1. Case report generation via POST /api/cases/{id}/report
    2. Case status transitions to 'reported'
    3. SHA-256 pre-verification logged in audit trail and evidence table
    4. Deterministic JSON structure & report_json_sha256 hash match
    5. Clean ReportLab PDF generation with all 11 required sections
    6. PDF text extraction checking banner, unreviewed count, escaped characters, and full hash
    7. File streaming endpoints for .pdf and .json
    """
    case_id = f"case_report_test_{uuid4().hex[:8]}"
    _setup_populated_case(case_id)

    # 1. Trigger Report Generation
    res_post = client.post(
        f"/api/cases/{case_id}/report",
        json={"case_id": case_id, "format": "json"}
    )
    assert res_post.status_code == 200, res_post.text
    rep_res = res_post.json()

    # Verify return payload has required fields
    assert "report_id" in rep_res
    assert "pdf_url" in rep_res
    assert "json_url" in rep_res
    assert "report_json_sha256" in rep_res
    report_id = rep_res["report_id"]
    report_sha256 = rep_res["report_json_sha256"]
    assert len(report_sha256) == 64

    # 2. Verify Case Status transitioned to 'reported'
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        assert case_row is not None
        assert case_row["status"] == "reported"

        # Verify audit log contains GENERATE_REPORT and pre-report VERIFY_HASH entries
        cursor.execute("SELECT action FROM audit_log WHERE case_id = ?", (case_id,))
        actions = [r["action"] for r in cursor.fetchall()]
        assert "GENERATE_REPORT" in actions
        assert "VERIFY_HASH" in actions

    # 3. Verify JSON Report on Disk
    json_path = settings.artifacts_dir / case_id / "reports" / f"{report_id}.json"
    assert json_path.exists(), f"Missing JSON artifact: {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        rep_json = json.load(f)

    # Validate report_meta
    meta = rep_json["report_meta"]
    assert meta["report_id"] == report_id
    assert meta["case_id"] == case_id
    assert "Campus Demonstration" in meta["case_title"]
    assert "Decision-Support Report — Not a Forensic Verdict" in meta["disclaimer"]
    assert "Provenance-aware audit trail" in meta["custody_note"]
    assert meta["tool_version"] == "1.0.0"

    # Validate case_summary
    summary = rep_json["case_summary"]
    assert summary["review_priority"] == "high"  # Due to strong observation
    assert summary["review_priority_formula"] == FORMULA_EXPLANATION
    assert summary["strength_counts"]["strong"] == 1
    assert summary["strength_counts"]["moderate"] == 1
    assert summary["strength_counts"]["weak"] == 1
    assert summary["strength_counts"]["informational"] == 1
    assert summary["review_status_counts"]["unreviewed"] == 2
    assert summary["review_status_counts"]["confirmed"] == 1
    assert summary["review_status_counts"]["dismissed"] == 1
    assert summary["unreviewed_count"] == 2

    # Validate evidence_table
    ev_table = rep_json["evidence_table"]
    assert len(ev_table) >= 2
    for ev in ev_table:
        assert ev["verification_status"] == "PASS"
        assert len(ev["sha256"]) == 64

    # Validate media_metadata
    assert "media_metadata" in rep_json
    assert len(rep_json["media_metadata"]) >= 2

    # Validate methods_used
    methods = rep_json["methods_used"]
    assert len(methods) >= 2
    skipped_method = next((m for m in methods if m["status"] == "skipped_missing_model"), None)
    assert skipped_method is not None
    assert "Speech model weights not installed locally" in skipped_method["error"]

    # Validate findings (sorted strictly by strength: strong -> moderate -> weak -> informational)
    findings = rep_json["findings"]
    assert len(findings) == 4
    assert findings[0]["evidence_strength"] == "strong"
    assert findings[1]["evidence_strength"] == "moderate"
    assert findings[2]["evidence_strength"] == "weak"
    assert findings[3]["evidence_strength"] == "informational"

    # Verify model score explicit labeling
    assert "uncalibrated model output" in findings[0]["model_score_display"]
    assert "uncalibrated model output" in findings[1]["model_score_display"]

    # Verify review status and notes
    assert findings[0]["human_review_status"] == "confirmed"
    assert "Forensic solar verification confirmed" in findings[0]["latest_reviewer_note"]
    assert findings[1]["human_review_status"] == "dismissed"
    assert findings[2]["human_review_status"] == "unreviewed"
    assert findings[3]["human_review_status"] == "unreviewed"

    # Validate cross-modal relationships
    edges = rep_json["cross_modal_relationships"]
    assert len(edges) >= 1
    assert edges[0]["relation"] == "CONTRADICTS"
    assert edges[0]["rule"] == "R3_number_mismatch"

    # Validate timeline
    assert len(rep_json["timeline"]) >= 1

    # Validate limitations and alternative explanations
    lim = rep_json["limitations_and_alternatives"]
    assert "image" in lim["per_modality_risks"]
    assert "video" in lim["per_modality_risks"]
    assert "audio" in lim["per_modality_risks"]
    assert "text" in lim["per_modality_risks"]
    for cat in ("measurement", "model", "interpretation", "coverage", "transcription"):
        assert cat in lim["uncertainty_categories"]

    # Validate recommendations for human review
    recs = rep_json["human_review_recommendations"]
    assert len(recs) >= 3

    # Validate audit excerpt and chain integrity
    audit = rep_json["audit_excerpt"]
    assert audit["audit_chain_valid"] is True
    assert audit["audit_count"] >= 3

    # Validate report_json_sha256 calculation
    canonical_dict = {k: v for k, v in rep_json.items() if k != "report_json_sha256"}
    expected_sha256 = hashlib.sha256(canonicalize_json(canonical_dict).encode("utf-8")).hexdigest()
    assert rep_json["report_json_sha256"] == expected_sha256
    assert rep_json["report_json_sha256"] == report_sha256

    # 4. Verify PDF Report on Disk & Parse with PyPDF
    pdf_path = settings.artifacts_dir / case_id / "reports" / f"{report_id}.pdf"
    assert pdf_path.exists(), f"Missing PDF artifact: {pdf_path}"

    reader = PdfReader(str(pdf_path))
    assert len(reader.pages) >= 1, "PDF should contain at least 1 page"

    pdf_full_text = ""
    for page in reader.pages:
        pdf_full_text += page.extract_text() + "\n"

    # Assert all 11 required sections are present
    required_sections = [
        "1. Cover & Summary Banner",
        "2. Evidence Table & Pre-Report Hash Verification",
        "3. Media Metadata",
        "4. Methods Used & Analysis Runs",
        "5. Findings Table",
        "6. Cross-Modal Relationships",
        "7. Provenance & Tamper Timeline",
        "8. Limitations & Alternative Explanations",
        "9. Recommendations for Human Review",
        "10. Analysis History & Audit Log Excerpt",
        "11. Report Integrity Footer",
    ]
    for sec in required_sections:
        assert sec in pdf_full_text, f"PDF missing required section: '{sec}'"

    # Assert Prominent Banner
    assert "DECISION-SUPPORT ONLY — NOT A VERDICT" in pdf_full_text

    # Assert Review Priority and Formula
    assert "HIGH" in pdf_full_text
    assert "Deterministic Review-Priority Logic" in pdf_full_text

    # Assert Unreviewed Findings Count
    assert "2 Unreviewed Findings" in pdf_full_text

    # Assert Escaped Special Characters rendered cleanly as text (not crashing XML)
    assert "<script>&" in pdf_full_text or "<script>" in pdf_full_text

    # Assert Full SHA-256 Hash is present in footer
    assert report_sha256 in pdf_full_text

    # 5. Verify Streaming Endpoints
    # GET /api/reports/{id}.pdf
    res_pdf_stream = client.get(f"/api/reports/{report_id}.pdf")
    assert res_pdf_stream.status_code == 200
    assert "application/pdf" in res_pdf_stream.headers.get("content-type", "")
    assert "inline" in res_pdf_stream.headers.get("content-disposition", "")
    assert res_pdf_stream.content.startswith(b"%PDF")

    # GET /api/reports/{id}.json
    res_json_stream = client.get(f"/api/reports/{report_id}.json")
    assert res_json_stream.status_code == 200
    assert "application/json" in res_json_stream.headers.get("content-type", "")
    streamed_data = res_json_stream.json()
    assert streamed_data["report_meta"]["report_id"] == report_id
    assert streamed_data["report_json_sha256"] == report_sha256

    # Test 404 on non-existent report
    res_404 = client.get("/api/reports/non_existent_id.pdf")
    assert res_404.status_code == 404

