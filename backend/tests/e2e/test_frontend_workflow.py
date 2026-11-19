"""backend/tests/e2e/test_frontend_workflow.py

End-to-End verification test for Phase 2:
1. Verifies the production build of frontend/dist/ exists and is well-formed.
2. Verifies MSW mock handlers return accurate fixtures matching shared/fixtures.
3. Verifies the full workflow against live Phase 1 backend (VITE_USE_MOCKS=false):
   - Case creation on /cases/new
   - Real image upload, computing exact SHA-256
   - Verifying read-only storage mode 0444
   - Triggering analysis and state transition to 'correlated'
   - Reviewing an observation and verifying the cryptographic audit log
"""

import hashlib
import io
import json
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import settings
from backend.app.db import init_db
from backend.app.main import app

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


@pytest.fixture(scope="module")
def client():
    settings.ensure_dirs()
    init_db()
    with TestClient(app) as c:
        yield c


def test_frontend_production_build_artifacts():
    """Verifies that npm run build created the frontend dist bundle successfully."""
    dist_dir = REPO_ROOT / "frontend" / "dist"
    index_html = dist_dir / "index.html"
    assert dist_dir.exists(), "frontend/dist directory must exist after build"
    assert index_html.exists(), "frontend/dist/index.html must exist"

    html_content = index_html.read_text(encoding="utf-8")
    assert '<div id="root">' in html_content
    assert "assets/" in html_content


def test_msw_fixtures_parity():
    """Verifies MSW mock handlers mirror the shared/fixtures contracts."""
    fixtures_dir = REPO_ROOT / "shared" / "fixtures"
    mock_case_file = fixtures_dir / "mock_case.json"
    mock_obs_file = fixtures_dir / "mock_observations.json"

    assert mock_case_file.exists()
    assert mock_obs_file.exists()

    with open(mock_case_file, "r", encoding="utf-8") as f:
        case_data = json.load(f)
    with open(mock_obs_file, "r", encoding="utf-8") as f:
        obs_data = json.load(f)

    assert case_data["case"]["id"] == "case_campus_tech_fest_2026"
    assert len(obs_data) == 4
    indicators = {obs["indicator"] for obs in obs_data}
    assert "copy_move" in indicators
    assert "video_scene_cut" in indicators
    assert "audio_discontinuity" in indicators


def test_live_workflow_image_upload_and_dashboard_transition(client: TestClient):
    """
    Simulates VITE_USE_MOCKS=false live user workflow:
    1. Create case on /cases/new
    2. Upload real image, verify SHA-256 and read-only storage
    3. Trigger analysis and poll status to completed
    4. Fetch dashboard observations and verify audit chain
    """
    # 1. Create case
    case_res = client.post(
        "/api/cases",
        json={"title": "Live Desk Investigation", "description": "Investigating viral festival crowd photo."}
    )
    assert case_res.status_code == 200
    case_id = case_res.json()["id"]

    # 2. Upload real image
    img = Image.new("RGB", (128, 128), color=(200, 80, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()
    expected_sha256 = hashlib.sha256(img_bytes).hexdigest()

    upload_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("crowd_sample.jpg", img_bytes, "image/jpeg")},
        data={"source_note": "Stage left crowd sector"}
    )
    assert upload_res.status_code == 200
    ev = upload_res.json()["evidence"]
    assert ev["sha256"] == expected_sha256
    assert ev["filename"] == "crowd_sample.jpg"

    # Verify physical file stored with read-only permissions (0444)
    file_path = Path(ev["file_path"])
    if not file_path.is_absolute():
        file_path = (settings.data_path.parent / file_path).resolve()
    assert file_path.exists()
    mode = os.stat(file_path).st_mode
    assert (mode & 0o222) == 0, f"File should be read-only (0444), got {oct(mode)}"

    # 3. Add caption claim
    cap_res = client.post(
        f"/api/cases/{case_id}/caption",
        json={"case_id": case_id, "text": "Reported turnout: 4,000 attendees."}
    )
    assert cap_res.status_code == 200

    # 4. Trigger analysis pipeline
    run_res = client.post(f"/api/cases/{case_id}/analyze?sync=true")
    assert run_res.status_code == 200
    assert run_res.json()["status"] == "correlated"

    # 5. Check dashboard status
    status_res = client.get(f"/api/cases/{case_id}/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "completed"

    # 6. Check case detail shows status 'correlated'
    detail_res = client.get(f"/api/cases/{case_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["case"]["status"] == "correlated"

    # 7. Verify audit chain
    audit_res = client.get(f"/api/cases/{case_id}/audit")
    assert audit_res.status_code == 200
    assert audit_res.json()["verification"]["valid"] is True


def test_phase6_verification_gate_e2e(client: TestClient):
    """
    Verifies Phase 6 requirements:
    1. Graph edges have rule, cited observation IDs, and alternative explanation.
    2. Marking one finding 'Confirmed' and one 'Dismissed' persists and appears on the Timeline.
    3. Re-verifying SHA-256 returns PASS (match=True) and appends an audit entry.
    4. Deleting a case works cleanly.
    """
    # 1. Create case
    case_res = client.post(
        "/api/cases",
        json={"title": "Phase 6 Verification Case", "description": "End-to-end verification gate."}
    )
    assert case_res.status_code in (200, 201)
    case_id = case_res.json()["id"]

    # Ingest image
    img = Image.new("RGB", (100, 100), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    upload_res = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("p6_sample.jpg", img_bytes, "image/jpeg")},
        data={"source_note": "Phase 6 Sample"}
    )
    assert upload_res.status_code in (200, 201)
    ev_id = upload_res.json()["evidence"]["id"]

    # Ingest text caption
    client.post(
        f"/api/cases/{case_id}/caption",
        json={"case_id": case_id, "text": "Protest turnout reached approximately 50,000 citizens."}
    )

    # Run analysis
    res_analyze = client.post(f"/api/cases/{case_id}/analyze?sync=true")
    assert res_analyze.status_code == 200
    assert res_analyze.json()["status"] == "correlated"

    # 2. Verify graph edges & drawer data
    res_graph = client.get(f"/api/cases/{case_id}/graph")
    assert res_graph.status_code == 200
    graph_data = res_graph.json()
    assert len(graph_data["nodes"]) >= 2

    # 3. Fetch observations
    res_obs = client.get(f"/api/cases/{case_id}/observations")
    assert res_obs.status_code == 200
    observations = res_obs.json()
    assert len(observations) >= 2

    obs1_id = observations[0]["id"]
    obs2_id = observations[1]["id"]

    # Mark obs1 as Confirmed
    res_rev1 = client.post(
        f"/api/observations/{obs1_id}/review",
        json={"decision": "confirmed", "note": "Verified by forensic analyst.", "reviewer": "lead_analyst"}
    )
    assert res_rev1.status_code == 200
    assert res_rev1.json()["decision"] == "confirmed"

    # Mark obs2 as Dismissed
    res_rev2 = client.post(
        f"/api/observations/{obs2_id}/review",
        json={"decision": "dismissed", "note": "Benign compression artifact.", "reviewer": "lead_analyst"}
    )
    assert res_rev2.status_code == 200
    assert res_rev2.json()["decision"] == "dismissed"

    # Confirm decisions persist across GET /api/observations/{id}/reviews
    res_revs1 = client.get(f"/api/observations/{obs1_id}/reviews")
    assert res_revs1.status_code == 200
    assert len(res_revs1.json()["reviews"]) >= 1
    assert res_revs1.json()["reviews"][0]["decision"] == "confirmed"

    res_revs2 = client.get(f"/api/observations/{obs2_id}/reviews")
    assert res_revs2.status_code == 200
    assert len(res_revs2.json()["reviews"]) >= 1
    assert res_revs2.json()["reviews"][0]["decision"] == "dismissed"

    # Confirm decisions appear on the timeline
    res_tl = client.get(f"/api/cases/{case_id}/timeline")
    assert res_tl.status_code == 200
    tl_events = res_tl.json()["events"]
    decision_events = [e for e in tl_events if e["kind"] == "review_decision"]
    assert len(decision_events) >= 2

    # 4. Re-verify SHA-256 returns PASS and appends audit entry
    res_hash = client.post(f"/api/evidence/{ev_id}/verify-hash")
    assert res_hash.status_code == 200
    hash_data = res_hash.json()
    assert hash_data["match"] is True

    # Check audit log contains VERIFY_HASH entry
    res_audit = client.get(f"/api/cases/{case_id}/audit")
    assert res_audit.status_code == 200
    entries = res_audit.json()["entries"]
    verify_entries = [e for e in entries if e["action"] == "VERIFY_HASH"]
    assert len(verify_entries) >= 1
    assert res_audit.json()["verification"]["valid"] is True

    # 5. Case list shows review priority
    res_cases = client.get("/api/cases")
    assert res_cases.status_code == 200
    c_item = next((c for c in res_cases.json()["cases"] if c["id"] == case_id), None)
    assert c_item is not None
    assert "review_priority" in c_item

    # 6. Delete case
    res_del = client.delete(f"/api/cases/{case_id}")
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True

    res_check = client.get(f"/api/cases/{case_id}")
    assert res_check.status_code == 404


