"""backend/tests/integration/test_api_core.py

Integration test suite for TruthLens X Phase 1:
Verifies SQLite database layer, immutable evidence store, hash-chained audit log,
safe subprocess runner, and FastAPI endpoints:
1. Case creation, image upload, SHA-256 calculation, read-only (0444) file check, and hash re-verification.
2. Uploading a fake .exe renamed to .jpg -> HTTP 415 (UNSUPPORTED_TYPE).
3. Uploading a corrupted .jpg -> HTTP 422 (CORRUPT_FILE) while keeping the case usable.
4. Deleting evidence with confirm=true -> file removed, row tombstoned, audit log entry hash-chained.
5. Triggering POST /api/cases/{id}/analyze -> status transitions through analyzing to correlated.
6. Verification of all additional endpoints (captions, reviews, graph, timeline, file stream, health, reports).
"""

import hashlib
import io
import os
from pathlib import Path
import stat
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import settings
from backend.app.db import init_db
from backend.app.main import app


@pytest.fixture(scope="module")
def client():
    # Ensure fresh test directory and DB initialized
    settings.ensure_dirs()
    init_db()
    with TestClient(app) as c:
        yield c


def create_sample_jpeg_bytes() -> bytes:
    """Generates a small valid JPEG in-memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=(45, 120, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ============================================================================
# Gate Requirement 1: Ingestion, SHA-256, Read-Only Store & Hash Verification
# ============================================================================

def test_case_creation_and_evidence_ingestion_and_hash_verification(client: TestClient):
    """Verifies case creation, evidence upload, SHA-256, read-only permissions, and hash check."""
    # 1. Create case
    case_payload = {
        "title": "Operation Quad Horizon",
        "description": "Investigating rally attendance claims."
    }
    res = client.post("/api/cases", json=case_payload)
    assert res.status_code == 200, res.text
    case_data = res.json()
    case_id = case_data["id"]
    assert case_data["title"] == case_payload["title"]
    assert case_data["status"] == "created"

    # 2. Upload valid JPEG evidence
    jpeg_bytes = create_sample_jpeg_bytes()
    expected_sha256 = hashlib.sha256(jpeg_bytes).hexdigest()

    upload_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("quad_ground.jpg", jpeg_bytes, "image/jpeg")},
        data={"source_note": "Handheld photo from stage entrance"}
    )
    assert upload_res.status_code == 200, upload_res.text
    ev_data = upload_res.json()["evidence"]
    evidence_id = ev_data["id"]
    assert ev_data["sha256"] == expected_sha256
    assert ev_data["filename"] == "quad_ground.jpg"
    assert ev_data["modality"] == "image"

    # 3. Verify file stored in data/evidence/<case_id>/<sha256>.<ext> with mode 0444 (read-only)
    stored_path = Path(ev_data["file_path"])
    if not stored_path.is_absolute():
        stored_path = (settings.data_path.parent / stored_path).resolve()

    assert stored_path.exists(), f"Evidence file missing on disk: {stored_path}"
    # File permissions check: write bit must NOT be set
    file_mode = os.stat(stored_path).st_mode
    assert (file_mode & 0o222) == 0, f"File should be read-only (0444), got mode {oct(file_mode)}"

    # 4. Verify hash re-verification endpoint
    verify_res = client.post(f"/api/evidence/{evidence_id}/verify-hash")
    assert verify_res.status_code == 200, verify_res.text
    v_data = verify_res.json()
    assert v_data["match"] is True
    assert v_data["expected_sha256"] == expected_sha256
    assert v_data["actual_sha256"] == expected_sha256

    # 5. Verify cryptographic audit chain integrity
    audit_res = client.get(f"/api/cases/{case_id}/audit")
    assert audit_res.status_code == 200, audit_res.text
    audit_data = audit_res.json()
    assert audit_data["verification"]["valid"] is True
    assert audit_data["verification"]["count"] >= 3  # CREATE_CASE, INGEST_EVIDENCE, VERIFY_HASH


# ============================================================================
# Gate Requirement 2: Reject Fake .exe Renamed to .jpg (HTTP 415 UNSUPPORTED_TYPE)
# ============================================================================

def test_upload_fake_exe_rejected_415(client: TestClient):
    """Rejects executable disguised as JPEG with HTTP 415 UNSUPPORTED_TYPE."""
    # Create test case
    res = client.post("/api/cases", json={"title": "Malware Check Case"})
    case_id = res.json()["id"]

    # Windows PE executable header (MZ)
    fake_exe_bytes = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00FakePEPayload"

    upload_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("innocent_photo.jpg", fake_exe_bytes, "image/jpeg")}
    )
    assert upload_res.status_code == 415, f"Expected 415, got {upload_res.status_code}: {upload_res.text}"
    err = upload_res.json()["error"]
    assert err["code"] == "UNSUPPORTED_TYPE"
    assert "Executable file detected" in err["message"]


# ============================================================================
# Gate Requirement 3: Reject Corrupt .jpg (HTTP 422 CORRUPT_FILE) & Case Remains Usable
# ============================================================================

def test_upload_corrupted_jpg_rejected_422(client: TestClient):
    """Rejects malformed JPEG with HTTP 422 CORRUPT_FILE and ensures case stays usable."""
    # Create test case
    res = client.post("/api/cases", json={"title": "Corruption Check Case"})
    case_id = res.json()["id"]

    # JPEG header followed by corrupt garbage that fails Pillow verification
    corrupt_jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00CorruptedDataStreamTrun"

    upload_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("broken.jpg", corrupt_jpg_bytes, "image/jpeg")}
    )
    assert upload_res.status_code == 422, f"Expected 422, got {upload_res.status_code}: {upload_res.text}"
    err = upload_res.json()["error"]
    assert err["code"] == "CORRUPT_FILE"

    # Verify the case is still fully usable and accessible
    case_res = client.get(f"/api/cases/{case_id}")
    assert case_res.status_code == 200
    assert case_res.json()["case"]["id"] == case_id


# ============================================================================
# Gate Requirement 4: Delete Evidence with confirm=true, Tombstone & Hash Chain
# ============================================================================

def test_delete_evidence_tombstone_and_audit(client: TestClient):
    """Verifies evidence deletion requires confirm=true, removes file, and tombstones row."""
    # Create case and upload file
    c_res = client.post("/api/cases", json={"title": "Deletion Target Case"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_sample_jpeg_bytes()
    up_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("to_delete.jpg", jpeg_bytes, "image/jpeg")}
    )
    ev_data = up_res.json()["evidence"]
    evidence_id = ev_data["id"]

    file_path = Path(ev_data["file_path"])
    if not file_path.is_absolute():
        file_path = (settings.data_path.parent / file_path).resolve()
    assert file_path.exists()

    # 1. Attempt delete without confirm -> HTTP 400
    del_fail = client.delete(f"/api/evidence/{evidence_id}")
    assert del_fail.status_code == 400

    # 2. Delete with confirm=true -> HTTP 200
    del_ok = client.delete(f"/api/evidence/{evidence_id}?confirm=true")
    assert del_ok.status_code == 200
    assert del_ok.json()["deleted"] is True

    # 3. File removed from disk
    assert not file_path.exists(), "File should be removed from disk"

    # 4. Fetch evidence file endpoint now returns 404
    file_fetch = client.get(f"/api/evidence/{evidence_id}/file")
    assert file_fetch.status_code == 404

    # 5. Evidence list excludes deleted evidence
    case_detail = client.get(f"/api/cases/{case_id}").json()
    active_ev_ids = [e["id"] for e in case_detail["evidence_items"]]
    assert evidence_id not in active_ev_ids

    # 6. Audit chain verifies successfully including the DELETE_EVIDENCE entry
    audit_res = client.get(f"/api/cases/{case_id}/audit").json()
    assert audit_res["verification"]["valid"] is True
    actions = [entry["action"] for entry in audit_res["entries"]]
    assert "DELETE_EVIDENCE" in actions


# ============================================================================
# Gate Requirement 5: Trigger Analysis Pipeline & State Transition
# ============================================================================

def test_pipeline_trigger_transitions_status(client: TestClient):
    """Verifies pipeline runs end-to-end and transitions case status to 'correlated'."""
    # Create case and upload image
    c_res = client.post("/api/cases", json={"title": "Pipeline State Machine Case"})
    case_id = c_res.json()["id"]

    jpeg_bytes = create_sample_jpeg_bytes()
    client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("pipeline_sample.jpg", jpeg_bytes, "image/jpeg")}
    )

    # Trigger synchronous analysis
    analyze_res = client.post(f"/api/cases/{case_id}/analyze?sync=true")
    assert analyze_res.status_code == 200, analyze_res.text
    res_data = analyze_res.json()
    assert res_data["status"] == "correlated"
    assert res_data["evidence_processed"] == 1

    # Status endpoint check
    st_res = client.get(f"/api/cases/{case_id}/status")
    assert st_res.status_code == 200
    assert st_res.json()["status"] == "completed"
    assert st_res.json()["progress_percent"] == 100.0

    # Case detail status check
    detail_res = client.get(f"/api/cases/{case_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["case"]["status"] == "correlated"


# ============================================================================
# Additional Endpoints Verification
# ============================================================================

def test_caption_review_and_ancillary_endpoints(client: TestClient):
    """Verifies captions, reviews, graph, timeline, health, and report stubs."""
    # 1. Health check
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "ok"
    assert health_res.json()["offline"] is True

    # 2. Case with caption
    c_res = client.post("/api/cases", json={"title": "Caption and Review Test Case"})
    case_id = c_res.json()["id"]

    caption_res = client.post(
        f"/api/cases/{case_id}/caption",
        json={"case_id": case_id, "text": "Reported 5,000 attendees at Main Hall."}
    )
    assert caption_res.status_code == 200
    assert caption_res.json()["text"] == "Reported 5,000 attendees at Main Hall."

    # 3. Timeline
    timeline_res = client.get(f"/api/cases/{case_id}/timeline")
    assert timeline_res.status_code == 200
    assert len(timeline_res.json()["events"]) >= 1

    # 4. Graph
    graph_res = client.get(f"/api/cases/{case_id}/graph")
    assert graph_res.status_code == 200
    assert "nodes" in graph_res.json()
    assert "edges" in graph_res.json()

    # 5. Review decision on case
    review_res = client.post(
        f"/api/observations/{case_id}/review",
        json={"decision": "confirmed", "note": "Verified by lead reviewer.", "reviewer": "lead_analyst"}
    )
    assert review_res.status_code == 200
    assert review_res.json()["decision"] == "confirmed"

    # 6. Report endpoints
    report_post = client.post(
        f"/api/cases/{case_id}/report",
        json={"case_id": case_id, "format": "json"}
    )
    assert report_post.status_code == 200
    rep_data = report_post.json()
    assert "report_id" in rep_data
    assert "report_json_sha256" in rep_data

    report_pdf = client.get(f"/api/reports/{case_id}.pdf")
    assert report_pdf.status_code == 200
    assert "application/pdf" in report_pdf.headers.get("content-type", "")

    report_json = client.get(f"/api/reports/{case_id}.json")
    assert report_json.status_code == 200
    assert "report_meta" in report_json.json()

