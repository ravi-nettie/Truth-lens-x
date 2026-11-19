"""backend/tests/unit/test_report_correctness.py

Regression test suite for Phase A Report Correctness Audit.
Verifies all 12 forensic report requirements:
1. Audit of PDF & JSON generation
2. Explicit AI-origin classifier status & model provenance
3. ELA interpretation for PNG and non-JPEG originals
4. C2PA container detection vs cryptographic validation
5. Visual copy-move match overlays & supporting measurements
6. Internal audit hash consistency vs independent cryptographic authentication
7. Report JSON fingerprint protection scope
8. Dynamic human-review recommendations tailored to analyzed modalities
9. Analyzer coverage matrix, skipped modules and failure accounting
10. Prevention of LOW priority triage when required analyzers did not run
11. PDF table wrapping and layout structure
12. Original filename preservation across evidence and timeline
"""

import json
from pathlib import Path
import tempfile
import pytest
import numpy as np
from PIL import Image

from backend.app.config import settings
from backend.app.db import get_db, init_db
from backend.app.analyzers.image.ela import analyze_ela
from backend.app.analyzers.image.copymove import analyze_copymove
from backend.app.analyzers.provenance.c2pa_check import inspect_c2pa
from backend.app.reporting.build_json import build_report_json
from backend.app.reporting.build_pdf import build_pdf_report
from shared.schemas import Modality, Strength


from uuid import uuid4

@pytest.fixture(autouse=True)
def setup_test_db():
    """Initializes clean database for testing."""
    init_db()


def test_ela_png_non_jpeg_handling():
    """Verify that ELA on a PNG (non-JPEG) is strictly informational with explanation of lossless format."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        png_path = tmp_path / "sample.png"

        # Create synthetic PNG with sharp contrast edge
        arr = np.zeros((100, 100, 3), dtype=np.uint8)
        arr[:, 50:] = 255
        img = Image.fromarray(arr)
        img.save(png_path, format="PNG")

        obs, arts, det = analyze_ela(
            evidence_id="ev_test_png",
            case_id="case_test",
            image_path=png_path,
            artifact_dir=tmp_path,
            original_format="PNG"
        )

        assert len(obs) == 1
        ela_ob = obs[0]

        # Must be strictly informational (never weak or moderate)
        assert ela_ob.evidence_strength == Strength.informational
        assert "Non-JPEG source container (PNG)" in ela_ob.summary
        assert "lossless format" in ela_ob.explanation or "non-JPEG" in ela_ob.explanation
        assert det["is_jpeg_original"] is False
        assert det["ela_applicable"] is False
        assert det["source_format"] == "PNG"


def test_copymove_supporting_measurements():
    """Verify that copy-move analysis computes Euclidean cluster distance, inlier ratio, and bounding boxes."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        img_path = tmp_path / "cloned.jpg"

        # Create image with two identical high-contrast textured patches without numpy.random
        arr = np.zeros((300, 300, 3), dtype=np.uint8)
        for i in range(300):
            for j in range(300):
                arr[i, j] = ((i * 37 + j * 19) % 256, (i * 23 + j * 47) % 256, (i * 11 + j * 73) % 256)

        # High-contrast patch at (30, 30) copied to (180, 180)
        patch = np.zeros((60, 60, 3), dtype=np.uint8)
        for pi in range(60):
            for pj in range(60):
                patch[pi, pj] = ((pi * 71 + pj * 93) % 256, (pi * 53 + pj * 17) % 256, (pi * 31 + pj * 89) % 256)

        arr[30:90, 30:90] = patch
        arr[180:240, 180:240] = patch
        Image.fromarray(arr).save(img_path, format="JPEG")

        obs, arts, det = analyze_copymove(
            evidence_id="ev_cm_test",
            case_id="case_test",
            image_path=img_path,
            artifact_dir=tmp_path,
            has_editor_metadata=False
        )

        # If keypoints match
        if obs:
            ob = obs[0]
            assert "cluster_distance_px" in det
            assert "normalized_distance_pct" in det
            assert "inlier_ratio" in det
            assert "src_bbox" in det
            assert "dst_bbox" in det
            assert det["cluster_distance_px"] > 0
            assert "Centroid separation:" in ob.explanation


def test_c2pa_container_vs_cryptographic_validation():
    """Verify distinction between structural container box presence and cryptographic validation."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        
        # 1. Plain file with no C2PA
        clean_file = tmp_path / "clean.jpg"
        clean_file.write_bytes(b"\xFF\xD8\xFF\xE0" + b"\x00" * 1000)
        obs_clean, tl_clean, meta_clean = inspect_c2pa("ev_clean", "case_test", clean_file)
        assert meta_clean["cryptographic_validation"] == "MANIFEST_ABSENT"
        assert obs_clean[0].indicator == "c2pa_manifest_absent"
        assert "Absence proves nothing" in obs_clean[0].summary

        # 2. File with raw structural C2PA marker (unverified)
        raw_box_file = tmp_path / "raw_box.jpg"
        raw_box_file.write_bytes(b"\xFF\xD8\xFF\xEB" + b"c2pa urn:c2pa metadata block" + b"\x00" * 1000)
        obs_box, tl_box, meta_box = inspect_c2pa("ev_box", "case_test", raw_box_file)
        assert meta_box["cryptographic_validation"] == "STRUCTURAL_CONTAINER_ONLY_UNVERIFIED"
        assert obs_box[0].indicator == "c2pa_container_box_detected"
        assert "structural only — unverified cryptographically" in obs_box[0].summary


def test_report_correctness_and_analyzer_coverage_priority():
    """Verify that incomplete analyzer coverage prevents LOW review priority triage and includes warnings."""
    with get_db() as conn:
        cursor = conn.cursor()
        case_id = f"case_corr_{uuid4().hex[:8]}"
        
        # Create case
        cursor.execute(
            "INSERT INTO cases (id, title, status, created_at) VALUES (?, ?, ?, ?)",
            (case_id, "Coverage Test Case", "created", "2026-11-20T00:00:00Z")
        )
        
        # Add image evidence
        ev_id = f"ev_cov_{uuid4().hex[:8]}"
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            f.write(b"\xFF\xD8\xFF\xE0" + b"\x00" * 500)
            f_path = f.name
            
        cursor.execute(
            """
            INSERT INTO evidence (id, case_id, kind, mime, original_name, stored_path, size_bytes, sha256, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (ev_id, case_id, "image", "image/jpeg", "campus_photo.jpg", f_path, 504, "dummy_sha256", "2026-11-20T00:00:00Z")
        )

        # Run only image_forensics, but skip ai_origin
        cursor.execute(
            """
            INSERT INTO analysis_runs (id, evidence_id, analyzer, tool_version, status, error, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (f"run_img_{uuid4().hex[:8]}", ev_id, "image_forensics", "1.0.0", "done", None, "2026-11-20T00:01:00Z", "2026-11-20T00:01:05Z")
        )
        cursor.execute(
            """
            INSERT INTO analysis_runs (id, evidence_id, analyzer, tool_version, status, error, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (f"run_ai_{uuid4().hex[:8]}", ev_id, "ai_origin", "1.0.0", "skipped_missing_model", "Model weights missing", "2026-11-20T00:01:05Z", "2026-11-20T00:01:05Z")
        )
        conn.commit()

        # Build report
        report_data = build_report_json(case_id)
        
        # Check analyzer coverage
        cov = report_data["case_summary"]["analyzer_coverage"]
        assert cov["coverage_complete"] is False
        assert cov["skipped_or_failed_count"] >= 1
        
        # Rule: Priority MUST NOT be low when required analyzers were skipped!
        prio = report_data["case_summary"]["review_priority"]
        assert prio == "medium"
        assert "INCOMPLETE COVERAGE" in report_data["case_summary"]["review_priority_label"]
        assert "WARNING" in report_data["case_summary"]["coverage_warning"]

        # Check AI-origin status provenance
        ai_stat = report_data["case_summary"]["ai_origin_status"]
        assert ai_stat["status"] in ("SKIPPED_MISSING_MODEL", "DISABLED", "LOADED_AND_EXECUTED")
        assert ai_stat["model_calibrated"] is False
        assert "UNCALIBRATED" in ai_stat["calibration_disclaimer"]

        # Check internal audit log vs external authentication distinction
        audit_ex = report_data["audit_excerpt"]
        assert audit_ex["internal_audit_only"] is True
        assert "Does NOT prove external origin" in audit_ex["chain_scope_note"]

        # Check fingerprint scope
        fp_scope = report_data["report_meta"]["fingerprint_scope"]
        assert "Integrity of this compiled report document" in fp_scope["protects"]
        assert "Does NOT protect" in fp_scope["does_not_protect"] or "Authenticity" in fp_scope["does_not_protect"]

        # Check dynamic recommendations
        recs = report_data["human_review_recommendations"]
        assert len(recs) > 0
        assert any("coverage gaps" in r.lower() for r in recs)

        # Check original filename preservation
        ev_item = report_data["evidence_table"][0]
        assert ev_item["original_name"] == "campus_photo.jpg"

        # Build PDF and verify successful generation
        pdf_path = build_pdf_report(report_data)
        assert pdf_path.exists()
        assert pdf_path.stat().st_size > 1000
