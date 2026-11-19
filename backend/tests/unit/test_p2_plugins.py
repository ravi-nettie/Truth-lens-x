"""backend/tests/unit/test_p2_plugins.py

Unit tests for optional P2 stretch plug-ins:
- C2PA Content Credentials reader (backend/app/analyzers/provenance/c2pa_check.py)
- Optional Pretrained Detector Hook (backend/app/analyzers/plugins/detector_hook.py)
- Optional Local Semantic Similarity & Wording-Only Paraphraser (backend/app/analyzers/text/semantic.py)

Strict Rule Verifications:
- Rule 1: 100% offline, local-first
- Rule 2: Zero global fake score, model_calibrated=False, absence of C2PA proves nothing
- Rule 3: Read-only evidence, no unhandled exceptions
"""

import json
from pathlib import Path
import tempfile
import shutil
import pytest
from unittest.mock import patch

from shared.schemas import AnalysisContext, Modality, Observation, Strength
from backend.app.config import settings
from backend.app.analyzers.provenance.c2pa_check import (
    inspect_c2pa,
    scan_raw_container_for_c2pa,
    check_c2patool_binary,
)
from backend.app.analyzers.plugins.detector_hook import (
    is_detector_enabled,
    get_detector_model_path,
    run_optional_detector,
)
from backend.app.analyzers.text.semantic import (
    compute_dense_cosine_similarity,
    compute_semantic_similarity,
    create_semantic_similarity_observation,
    summarize_findings_wording_only,
    is_semantic_model_available,
)


@pytest.fixture
def tmp_work_dir():
    d = Path(tempfile.mkdtemp())
    yield d
    shutil.rmtree(d, ignore_errors=True)


# ---------------------------------------------------------------------------
# C2PA Manifest Reader Tests
# ---------------------------------------------------------------------------

def test_c2pa_absence_proves_nothing(tmp_work_dir):
    """Absence of C2PA manifest must be strictly informational and state it proves nothing."""
    dummy_file = tmp_work_dir / "clean.jpg"
    dummy_file.write_bytes(b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"\x00" * 200)

    observations, timeline_events, metadata = inspect_c2pa(
        evidence_id="ev_clean",
        case_id="case_c2pa_test",
        file_path=dummy_file,
        modality=Modality.image,
    )

    assert metadata["c2pa_manifest_found"] is False
    assert len(observations) == 1
    obs = observations[0]

    assert obs.indicator == "c2pa_manifest_absent"
    assert obs.evidence_strength == Strength.informational
    assert "proves nothing" in obs.limitations.lower()
    assert "vast majority of cameras" in obs.alternative_explanation.lower()


def test_c2pa_nonexistent_file():
    """Non-existent file should gracefully return empty results without crashing."""
    missing_file = Path("nonexistent_file_path_12345.jpg")
    observations, timeline_events, metadata = inspect_c2pa(
        evidence_id="ev_missing",
        case_id="case_c2pa_missing",
        file_path=missing_file,
    )
    assert observations == []
    assert timeline_events == []
    assert metadata["c2pa_manifest_found"] is False


def test_c2pa_raw_container_scan(tmp_work_dir):
    """Raw container bytes with JUMBF / c2pa markers are detected and marked informational."""
    c2pa_marker_file = tmp_work_dir / "marker.mp4"
    # Write MP4 container with embedded urn:c2pa marker
    c2pa_marker_file.write_bytes(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00urn:c2pa:jumbf" + b"\x00" * 100)

    has_c2pa = scan_raw_container_for_c2pa(c2pa_marker_file)
    assert has_c2pa is True

    # With c2patool absent, falling back to structural scan
    with patch("backend.app.analyzers.provenance.c2pa_check.check_c2patool_binary", return_value=None):
        observations, events, metadata = inspect_c2pa(
            evidence_id="ev_c2pa_box",
            case_id="case_box_test",
            file_path=c2pa_marker_file,
            modality=Modality.video,
        )

    assert metadata["c2pa_manifest_found"] is True
    assert len(observations) == 1
    assert observations[0].indicator == "c2pa_container_box_detected"
    assert observations[0].evidence_strength == Strength.informational


def test_c2pa_parsed_manifest_assertions(tmp_work_dir):
    """When c2patool returns valid JSON, assertions are converted to observations & timeline events."""
    manifest_file = tmp_work_dir / "signed.jpg"
    manifest_file.write_bytes(b"\xFF\xD8\xFF\xE1" + b"\x00" * 100)

    mock_manifest = {
        "active_manifest": {
            "claim_generator": "TestCameraFirmware/1.0",
            "title": "signed.jpg",
            "format": "image/jpeg",
            "assertions": [
                {
                    "label": "c2pa.actions",
                    "data": {
                        "actions": [
                            {"action": "c2pa.created", "when": "2026-10-15T10:00:00Z", "softwareAgent": "TestCamera/1.0"},
                            {"action": "c2pa.edited", "when": "2026-10-15T12:00:00Z", "softwareAgent": "TestEditor/2.0"},
                        ]
                    }
                }
            ]
        },
        "validation_status": "valid"
    }

    mock_res = type("SubprocessResult", (), {"stdout": json.dumps(mock_manifest)})()

    with patch("backend.app.analyzers.provenance.c2pa_check.check_c2patool_binary", return_value="/usr/bin/c2patool"), \
         patch("backend.app.analyzers.provenance.c2pa_check.run_safe_command", return_value=mock_res):
        observations, events, metadata = inspect_c2pa(
            evidence_id="ev_c2pa_parsed",
            case_id="case_parsed_test",
            file_path=manifest_file,
            modality=Modality.image,
        )

    assert metadata["c2pa_manifest_found"] is True
    assert len(observations) == 1
    assert observations[0].indicator == "c2pa_manifest_detected"
    assert observations[0].evidence_strength == Strength.informational
    assert "TestCameraFirmware" in observations[0].summary

    assert len(events) == 2
    assert "c2pa.created" in events[0].label
    assert "c2pa.edited" in events[1].label


# ---------------------------------------------------------------------------
# Pretrained Detector Hook Tests
# ---------------------------------------------------------------------------

def test_detector_disabled_by_default():
    """By default, ENABLE_OPTIONAL_MODELS=false, detector must return 'disabled'."""
    ctx = AnalysisContext(case_id="case_det_test", work_dir=".", artifact_dir=".")
    evidence = {"id": "ev_det_test", "stored_path": "dummy.jpg"}

    with patch.object(settings, "ENABLE_OPTIONAL_MODELS", False):
        status, obs, telemetry = run_optional_detector(evidence, ctx, Modality.image)

    assert status == "disabled"
    assert obs is None
    assert telemetry["enabled"] is False


def test_detector_skipped_missing_model(tmp_work_dir):
    """When enabled but weights absent, returns status='skipped_missing_model' with explanation."""
    ctx = AnalysisContext(case_id="case_det_test", work_dir=str(tmp_work_dir), artifact_dir=str(tmp_work_dir))
    evidence = {"id": "ev_det_test", "stored_path": "dummy.jpg"}

    with patch.object(settings, "ENABLE_OPTIONAL_MODELS", True), \
         patch.object(settings, "MODELS_DIR", str(tmp_work_dir / "empty_models")):
        status, obs, telemetry = run_optional_detector(evidence, ctx, Modality.image)

    assert status == "skipped_missing_model"
    assert obs is not None
    assert obs.indicator == "optional_detector_skipped"
    assert obs.evidence_strength == Strength.informational
    assert obs.model_calibrated is False
    assert "skipped" in obs.summary.lower()


def test_detector_with_weights_uncalibrated(tmp_work_dir):
    """When weights exist, detector runs but strictly enforces model_calibrated=False and uncalibrated label."""
    # Create fake weights file in models/detectors/image_detector.onnx
    models_dir = tmp_work_dir / "models" / "detectors"
    models_dir.mkdir(parents=True, exist_ok=True)
    fake_weights = models_dir / "image_detector.onnx"
    fake_weights.write_bytes(b"ONNX_FAKE_WEIGHTS_DATA")

    ctx = AnalysisContext(case_id="case_det_test", work_dir=str(tmp_work_dir), artifact_dir=str(tmp_work_dir))
    evidence = {"id": "ev_det_weights", "stored_path": "dummy.jpg"}

    with patch.object(settings, "ENABLE_OPTIONAL_MODELS", True), \
         patch.object(settings, "DATA_DIR", str(tmp_work_dir)), \
         patch.object(settings, "MODELS_DIR", str(tmp_work_dir / "models")):
        status, obs, telemetry = run_optional_detector(evidence, ctx, Modality.image)

    assert status == "done"
    assert obs is not None
    assert obs.model_score is not None
    assert obs.model_calibrated is False  # Mandatory Rule 2 invariant
    assert "uncalibrated model output" in obs.summary.lower()
    assert "never interpret as a posterior probability" in obs.limitations.lower()


# ---------------------------------------------------------------------------
# Semantic Similarity & Wording-Only Paraphraser Tests
# ---------------------------------------------------------------------------

def test_cosine_similarity_edge_cases():
    """Verify vector cosine similarity calculation handles normal and edge cases."""
    assert compute_dense_cosine_similarity([], []) == 0.0
    assert compute_dense_cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert abs(compute_dense_cosine_similarity([1.0, 0.0], [1.0, 0.0]) - 1.0) < 1e-5
    assert abs(compute_dense_cosine_similarity([1.0, 1.0], [2.0, 2.0]) - 1.0) < 1e-5
    assert compute_dense_cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_semantic_similarity_disabled_by_default():
    """Semantic similarity returns 'disabled' when ENABLE_OPTIONAL_MODELS=false."""
    with patch.object(settings, "ENABLE_OPTIONAL_MODELS", False):
        status, sim, telemetry = compute_semantic_similarity("Post caption", "Audio transcript")
    assert status == "disabled"
    assert sim is None


def test_semantic_similarity_skipped_missing_model(tmp_work_dir):
    """Semantic similarity returns 'skipped_missing_model' when weights are absent."""
    with patch.object(settings, "ENABLE_OPTIONAL_MODELS", True), \
         patch.object(settings, "MODELS_DIR", str(tmp_work_dir / "empty_models")):
        status, sim, telemetry = compute_semantic_similarity("Post caption", "Audio transcript")
    assert status == "skipped_missing_model"
    assert sim is None


def test_semantic_similarity_observation_informational():
    """Semantic observation must be strictly informational with explicit verdict disclaimer."""
    obs = create_semantic_similarity_observation(
        case_id="case_sem",
        evidence_id="ev_sem",
        similarity_score=0.785,
        telemetry={"model": "all-MiniLM-L6-v2"}
    )
    assert obs.evidence_strength == Strength.informational
    assert "not a verdict" in obs.limitations.lower()
    assert obs.indicator == "text_semantic_similarity"


def test_summarize_findings_wording_only_invariants():
    """
    Wording-only paraphraser MUST:
    - Synthesize only already-computed findings
    - Produce 0 new observations or graph edges
    - Maintain cited limitations and alternatives
    """
    empty_summary = summarize_findings_wording_only([])
    assert "No forensic observations recorded" in empty_summary

    test_obs = [
        Observation(
            id="obs_1",
            case_id="case_wording",
            evidence_id="ev_1",
            modality=Modality.video,
            indicator="video_scene_cut",
            method="histogram",
            summary="Hard scene cut detected at 00:07.4",
            explanation="Color histogram drop",
            alternative_explanation="Intentional creative edit or multi-clip compilation",
            evidence_strength=Strength.informational,
            limitations="Cuts do not inherently indicate deception.",
            details={}
        ),
        Observation(
            id="obs_2",
            case_id="case_wording",
            evidence_id="ev_2",
            modality=Modality.image,
            indicator="image_copy_move_ransac",
            method="orb_ransac",
            summary="Cloned patch matched with 18 keypoints",
            explanation="Inlier transformation cluster",
            alternative_explanation="Repetitive texture such as brickwork or foliage",
            evidence_strength=Strength.moderate,
            limitations="False positives possible on homogeneous grid patterns.",
            details={}
        ),
    ]

    summary = summarize_findings_wording_only(test_obs, case_title="Test Case")

    # Verify synthesis invariants
    assert "2 total indicators audited" in summary
    assert "Moderate Findings (1)" in summary
    assert "Informational Attributes (1)" in summary
    assert "Repetitive texture such as brickwork" in summary
    assert "No independent verdict or probability is implied" in summary
