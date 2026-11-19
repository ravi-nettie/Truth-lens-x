"""backend/tests/unit/test_schemas.py

Unit test suite verifying Pydantic v2 schemas and validation contracts:
1. Round-trip validation of every JSON file in shared/fixtures/
2. Verification that GraphEdge rejects an empty evidence_observation_ids list
3. Enforcement of Forensic Honesty & Language Rules (Rule 2)
"""

import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from shared.schemas import (
    CaseDetailResponse,
    CaseResponse,
    Claim,
    EvidenceResponse,
    GraphEdge,
    GraphResponse,
    Modality,
    Observation,
    Region,
    Strength,
    TimelineResponse,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "shared" / "fixtures"


# ============================================================================
# 1. Round-Trip Fixture Validations
# ============================================================================

def test_mock_case_roundtrip():
    """Validates mock_case.json against CaseDetailResponse with round-trip check."""
    path = FIXTURES_DIR / "mock_case.json"
    assert path.exists(), f"Missing fixture: {path}"

    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    parsed = CaseDetailResponse.model_validate(raw_data)
    assert parsed.case.id == "case_campus_tech_fest_2026"
    assert len(parsed.evidence_items) == 4

    # Round-trip serialization check
    dumped = parsed.model_dump(mode="json")
    re_parsed = CaseDetailResponse.model_validate(dumped)
    assert re_parsed == parsed


def test_mock_observations_roundtrip():
    """Validates mock_observations.json list with round-trip check."""
    path = FIXTURES_DIR / "mock_observations.json"
    assert path.exists(), f"Missing fixture: {path}"

    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    observations = [Observation.model_validate(item) for item in raw_data]
    assert len(observations) == 4

    # Verify specific test fixture observations exist
    indicators = {obs.indicator for obs in observations}
    assert "audio_discontinuity" in indicators
    assert "video_scene_cut" in indicators
    assert "copy_move" in indicators
    assert "caption_number_mismatch" in indicators

    # Verify scene cut is informational
    scene_cut = next(obs for obs in observations if obs.indicator == "video_scene_cut")
    assert scene_cut.evidence_strength == Strength.informational

    # Verify uncalibrated model rule
    copymove = next(obs for obs in observations if obs.indicator == "copy_move")
    assert copymove.model_score is not None
    assert copymove.model_calibrated is False

    # Round-trip serialization check
    for obs in observations:
        dumped = obs.model_dump(mode="json")
        re_parsed = Observation.model_validate(dumped)
        assert re_parsed == obs


def test_mock_graph_roundtrip():
    """Validates mock_graph.json against GraphResponse with round-trip check."""
    path = FIXTURES_DIR / "mock_graph.json"
    assert path.exists(), f"Missing fixture: {path}"

    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    graph = GraphResponse.model_validate(raw_data)
    assert graph.case_id == "case_campus_tech_fest_2026"
    assert len(graph.nodes) >= 4
    assert len(graph.edges) == 2

    # Verify R7_audio_visual_cut and R3_number_mismatch rules exist
    rules = {edge.rule for edge in graph.edges}
    assert "R7_audio_visual_cut" in rules
    assert "R3_number_mismatch" in rules

    # Verify CONTRADICTS edge has plain-language alternative explanation
    contradict_edge = next(e for e in graph.edges if e.relation == "CONTRADICTS")
    assert contradict_edge.alternative_explanation.strip() != ""

    # Round-trip serialization check
    dumped = graph.model_dump(mode="json")
    re_parsed = GraphResponse.model_validate(dumped)
    assert re_parsed == graph


def test_mock_timeline_roundtrip():
    """Validates mock_timeline.json against TimelineResponse with round-trip check."""
    path = FIXTURES_DIR / "mock_timeline.json"
    assert path.exists(), f"Missing fixture: {path}"

    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    timeline = TimelineResponse.model_validate(raw_data)
    assert timeline.case_id == "case_campus_tech_fest_2026"
    assert len(timeline.events) == 6

    # Round-trip serialization check
    dumped = timeline.model_dump(mode="json")
    re_parsed = TimelineResponse.model_validate(dumped)
    assert re_parsed == timeline


# ============================================================================
# 2. GraphEdge Rejection of Empty evidence_observation_ids
# ============================================================================

def test_graph_edge_rejects_empty_evidence_observation_ids():
    """Ensures GraphEdge raises ValidationError when evidence_observation_ids is empty."""
    with pytest.raises(ValidationError) as exc_info:
        GraphEdge(
            id="edge_invalid_01",
            case_id="case_01",
            src_id="node_a",
            dst_id="node_b",
            relation="SUPPORTS",
            rule="R1_test_rule",
            evidence_observation_ids=[],  # Must reject empty list (min_length=1)
            explanation="Test explanation",
            alternative_explanation="",
            strength=Strength.weak,
        )
    assert "evidence_observation_ids" in str(exc_info.value)


# ============================================================================
# 3. Forensic Honesty & Language Rules Enforcement (Rule 2)
# ============================================================================

def test_observation_requires_alternative_explanation_for_moderate():
    """Weak or moderate observations without alternative explanation must fail validation."""
    with pytest.raises(ValidationError) as exc_info:
        Observation(
            id="obs_bad_01",
            case_id="case_01",
            evidence_id="ev_01",
            modality=Modality.audio,
            indicator="audio_anomaly",
            method="test_method",
            summary="Test anomaly",
            explanation="Technical explanation",
            alternative_explanation="",  # Missing!
            evidence_strength=Strength.moderate,
            limitations="Some valid limitations statement.",
        )
    assert "alternative_explanation" in str(exc_info.value)


def test_observation_requires_limitations_for_moderate():
    """Weak or moderate observations without limitations statement must fail validation."""
    with pytest.raises(ValidationError) as exc_info:
        Observation(
            id="obs_bad_02",
            case_id="case_01",
            evidence_id="ev_01",
            modality=Modality.audio,
            indicator="audio_anomaly",
            method="test_method",
            summary="Test anomaly",
            explanation="Technical explanation",
            alternative_explanation="Plausible benign cause",
            evidence_strength=Strength.weak,
            limitations="",  # Missing!
        )
    assert "limitations" in str(exc_info.value)


def test_contradicts_edge_requires_alternative_explanation():
    """CONTRADICTS relation edge without alternative explanation must fail validation."""
    with pytest.raises(ValidationError) as exc_info:
        GraphEdge(
            id="edge_bad_01",
            case_id="case_01",
            src_id="claim_01",
            dst_id="claim_02",
            relation="CONTRADICTS",
            rule="R3_number_mismatch",
            evidence_observation_ids=["obs_01"],
            explanation="Contradiction observed",
            alternative_explanation="",  # Forbidden for CONTRADICTS
            strength=Strength.moderate,
        )
    assert "alternative_explanation" in str(exc_info.value)


def test_observation_rejects_calibrated_ml_score():
    """Pretrained ML models must never be marked calibrated=True (Rule 2)."""
    with pytest.raises(ValidationError) as exc_info:
        Observation(
            id="obs_bad_03",
            case_id="case_01",
            evidence_id="ev_01",
            modality=Modality.image,
            indicator="deepfake_face",
            method="ml_resnet",
            summary="Face detector output",
            explanation="Model output 0.95",
            alternative_explanation="Face compression artifact",
            evidence_strength=Strength.moderate,
            model_score=0.95,
            model_calibrated=True,  # Forbidden!
            limitations="Out of distribution on compressed web video.",
        )
    assert "model_calibrated=False" in str(exc_info.value)


def test_missing_exif_must_be_informational():
    """Missing EXIF alone cannot be suspicious (Rule 2)."""
    with pytest.raises(ValidationError) as exc_info:
        Observation(
            id="obs_bad_04",
            case_id="case_01",
            evidence_id="ev_01",
            modality=Modality.image,
            indicator="missing_exif",
            method="metadata_extractor",
            summary="EXIF was stripped",
            explanation="No EXIF header found",
            alternative_explanation="Messaging apps strip EXIF",
            evidence_strength=Strength.moderate,  # Forbidden! Must be informational
            limitations="Messaging platforms strip EXIF by default.",
        )
    assert "informational" in str(exc_info.value)


def test_text_modality_caps_at_moderate_strength():
    """Text-only observations cannot exceed moderate strength (Rule 2)."""
    with pytest.raises(ValidationError) as exc_info:
        Observation(
            id="obs_bad_05",
            case_id="case_01",
            evidence_id="ev_01",
            modality=Modality.text,
            indicator="text_discrepancy",
            method="ner_mismatch",
            summary="Names do not match",
            explanation="Named entity resolution failed",
            alternative_explanation="Colloquial nickname used",
            evidence_strength=Strength.strong,  # Forbidden! Must cap at moderate
            limitations="Text claims cannot be verified without primary sources.",
        )
    assert "cap at 'moderate' strength" in str(exc_info.value)
