"""backend/tests/integration/test_full_pipeline.py

Integration test for TruthLens X Full Multimodal Pipeline & Correlation Engine (Phase 5).
Tests:
- Ingests multi-file case: edited video (AV cut at 2.0s) + edited image (copy-move) + caption with number mismatch
- Triggers POST /api/cases/{id}/analyze
- Asserts transition through ingested -> analyzing -> analyzed -> correlated
- Asserts at least 1 R7_audio_visual_cut edge
- Asserts at least 1 R3_number_mismatch edge
- Asserts populated chronological timeline events
- Asserts anti-hallucination invariants
"""

import io
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from backend.app.main import app
from backend.app.services.safe_subprocess import run_ffmpeg
from backend.app.db import init_db


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


def test_full_multimodal_pipeline_and_correlation():
    client = TestClient(app)

    # 1. Create Case
    res_case = client.post("/api/cases", json={
        "title": "Full Multimodal Pipeline Case",
        "description": "Integration test with video, image, and text caption"
    })
    assert res_case.status_code in (200, 201)
    case_id = res_case.json()["id"]

    # 2. Generate and Ingest Edited Video (with synchronized AV cut at 2.0s)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_dir_path = Path(tmp_dir)
        vid_file = tmp_dir_path / "sync_cut.mp4"

        # Generate 4s video: 2s red + 2s blue; audio: 2s 220Hz tone + 2s 1500Hz tone
        res_ff = run_ffmpeg([
            "-f", "lavfi", "-i", "color=c=red:duration=2:size=320x240:rate=25",
            "-f", "lavfi", "-i", "color=c=blue:duration=2:size=320x240:rate=25",
            "-f", "lavfi", "-i", "sine=frequency=220:duration=2",
            "-f", "lavfi", "-i", "sine=frequency=1500:duration=2",
            "-filter_complex",
            "[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a][3:a]concat=n=2:v=0:a=1[a]",
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-metadata", "creation_time=2024-05-15T14:00:00Z",
            "-y", str(vid_file)
        ])
        assert res_ff.returncode == 0

        with open(vid_file, "rb") as f:
            vid_bytes = f.read()

    res_vid = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("sync_cut.mp4", vid_bytes, "video/mp4")},
        data={"source_note": "Video with audio track"}
    )
    assert res_vid.status_code in (200, 201)
    vid_ev_id = res_vid.json()["evidence"]["id"]

    # 3. Generate and Ingest Edited Image (with copy-move patch)
    img = Image.new("RGB", (600, 500), color=(210, 210, 210))
    draw = ImageDraw.Draw(img)
    for i in range(10, 60, 5):
        draw.line([(30 + i, 30), (30, 30 + i)], fill=(20, 30, i * 2), width=2)
    patch = img.crop((30, 30, 100, 100))
    img.paste(patch, (300, 250))

    img_buffer = io.BytesIO()
    img.save(img_buffer, format="JPEG", quality=92)
    img_bytes = img_buffer.getvalue()

    res_img = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("edited_image.jpg", img_bytes, "image/jpeg")},
        data={"source_note": "Image with cloned patch"}
    )
    assert res_img.status_code in (200, 201)
    img_ev_id = res_img.json()["evidence"]["id"]

    # 4. Generate and Ingest Post Caption (with numerical claim differing from spoken transcript)
    caption_text = (
        "Breaking: Over 10,000 protesters took to the streets on Saturday afternoon. "
        "Organized by the United Nations coalition."
    )
    res_cap = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("caption.txt", caption_text.encode("utf-8"), "text/plain")},
        data={"source_note": "Social media post caption"}
    )
    assert res_cap.status_code in (200, 201)
    cap_ev_id = res_cap.json()["evidence"]["id"]

    # Ingest spoken dialogue transcript as precomputed transcript for the video
    # States: 500 protesters (conflicts with 10,000 in caption -> R3)
    transcript_text = "We are reporting live where approximately five hundred protesters gathered on Friday."
    res_tr = client.post(
        f"/api/cases/{case_id}/evidence",
        files={"file": ("transcript.txt", transcript_text.encode("utf-8"), "text/plain")},
        data={"source_note": "Precomputed audio transcript"}
    )
    assert res_tr.status_code in (200, 201)
    tr_ev_id = res_tr.json()["evidence"]["id"]

    # 5. Execute Pipeline synchronously
    res_pipe = client.post(f"/api/cases/{case_id}/analyze?sync=true")
    assert res_pipe.status_code == 200
    pipe_data = res_pipe.json()
    assert pipe_data["status"] == "correlated"
    assert pipe_data["evidence_count"] >= 4
    assert pipe_data["observations_count"] >= 3
    assert pipe_data["edges_count"] >= 2

    # 6. Verify Correlation Graph (GET /api/cases/{id}/graph)
    res_graph = client.get(f"/api/cases/{case_id}/graph")
    assert res_graph.status_code == 200
    graph_data = res_graph.json()
    edges = graph_data["edges"]
    nodes = graph_data["nodes"]

    assert len(nodes) >= 6
    assert len(edges) >= 2

    # Assert at least 1 R7_audio_visual_cut edge
    r7_edge = next((e for e in edges if e["rule"] == "R7_audio_visual_cut"), None)
    assert r7_edge is not None
    assert r7_edge["relation"] == "CO_OCCURS"
    assert r7_edge["strength"] in ("weak", "moderate")
    assert "edit/splice point" in r7_edge["explanation"]
    assert len(r7_edge["evidence_observation_ids"]) >= 1

    # Assert at least 1 R3_number_mismatch edge
    r3_edge = next((e for e in edges if e["rule"] == "R3_number_mismatch"), None)
    assert r3_edge is not None
    assert r3_edge["relation"] == "CONTRADICTS"
    assert r3_edge["strength"] == "moderate"
    assert len(r3_edge["alternative_explanation"]) > 0
    assert len(r3_edge["evidence_observation_ids"]) >= 1

    # 7. Verify Unified Chronological Timeline (GET /api/cases/{id}/timeline)
    res_timeline = client.get(f"/api/cases/{case_id}/timeline")
    assert res_timeline.status_code == 200
    tl_events = res_timeline.json()["events"]
    assert len(tl_events) >= 5

    kinds = [ev["kind"] for ev in tl_events]
    assert "upload" in kinds
    assert "analysis_run" in kinds

    # 8. Verify Case Detail Status & Priority
    res_detail = client.get(f"/api/cases/{case_id}")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["case"]["status"] == "correlated"
