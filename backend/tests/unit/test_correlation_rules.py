"""backend/tests/unit/test_correlation_rules.py

Unit tests for TruthLens X Cross-Modal Correlation Engine (Rules R1-R8)
and Evidence Strength / Case Review-Priority Logic.
Adheres strictly to Rule 2:
- Tests all 8 correlation rules (R1 through R8)
- Verifies anti-hallucination invariants (len(evidence_observation_ids) >= 1)
- Verifies mandatory alternative explanations on all CONTRADICTS edges
- Verifies edge strength bounds
- Tests review_priority deterministic formula
"""

from typing import List
import pytest

from shared.schemas import Claim, GraphEdge, Modality, Observation, Strength
from backend.app.correlation.rules import evaluate_correlation_rules
from backend.app.correlation.strength import compute_case_review_priority


def make_obs(
    obs_id: str,
    evidence_id: str = "ev_1",
    modality: Modality = Modality.video,
    indicator: str = "video_scene_cut",
    strength: Strength = Strength.informational,
    time_start_ms: int = None,
    time_end_ms: int = None,
    details: dict = None
) -> Observation:
    alt = "Natural camera transition or routine pause." if strength in (Strength.weak, Strength.moderate) else ""
    lim = "Optical cut detection cannot distinguish benign edits from manipulation." if strength in (Strength.weak, Strength.moderate) else ""
    return Observation(
        id=obs_id,
        case_id="case_corr_test",
        evidence_id=evidence_id,
        modality=modality,
        indicator=indicator,
        method="automated_test_detector",
        summary=f"Observation {indicator}",
        explanation=f"Technical explanation for {indicator}",
        alternative_explanation=alt,
        evidence_strength=strength,
        time_start_ms=time_start_ms,
        time_end_ms=time_end_ms,
        details=details or {},
        limitations=lim
    )


# ============================================================================
# Rule R1: Temporal Coincidence
# ============================================================================

def test_r1_temporal_coincidence():
    # Two different modalities on same evidence within 500 ms
    o1 = make_obs("obs_video_motion", "ev_v1", Modality.video, "video_motion_jump", Strength.weak, time_start_ms=1000, time_end_ms=1050)
    o2 = make_obs("obs_audio_plosive", "ev_v1", Modality.audio, "audio_transient_spike", Strength.weak, time_start_ms=1200, time_end_ms=1250)

    evidence_list = [{"id": "ev_v1", "kind": "video"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [o1, o2], [])

    r1_edges = [e for e in edges if e.rule == "R1_temporal_coincidence"]
    assert len(r1_edges) >= 1
    edge = r1_edges[0]
    assert edge.relation == "CO_OCCURS"
    assert len(edge.evidence_observation_ids) >= 1
    assert set(edge.evidence_observation_ids) == {o1.id, o2.id}
    # Combined strength raised by at most 1 tier (weak -> moderate)
    assert edge.strength in (Strength.weak, Strength.moderate)


# ============================================================================
# Rule R2: Metadata vs Claim
# ============================================================================

def test_r2_metadata_vs_claim():
    c_claim = Claim(
        id="claim_c1",
        case_id="case_corr_test",
        source_evidence_id="ev_caption",
        source_kind="caption",
        text="Protest on 2024-05-10",
        claim_type="datetime",
        value={"date": "2024-05-10", "raw": "2024-05-10"}
    )
    m_claim = Claim(
        id="claim_m1",
        case_id="case_corr_test",
        source_evidence_id="ev_img",
        source_kind="exif",
        text="Captured on 2021-01-01",
        claim_type="datetime",
        value={"datetime_original": "2021-01-01 10:00:00", "iso8601": "2021-01-01T10:00:00"}
    )
    obs = make_obs("obs_exif_dto", "ev_img", Modality.image, "exif_metadata_inspection", Strength.informational)

    evidence_list = [{"id": "ev_caption", "kind": "text"}, {"id": "ev_img", "kind": "image"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [obs], [c_claim, m_claim])

    r2_edges = [e for e in edges if e.rule == "R2_metadata_vs_claim"]
    assert len(r2_edges) >= 1
    edge = r2_edges[0]
    assert edge.relation == "CONTRADICTS"
    assert len(edge.evidence_observation_ids) >= 1
    # Mandatory alternative explanation check
    assert len(edge.alternative_explanation) > 0
    assert "clock" in edge.alternative_explanation.lower() or "timezone" in edge.alternative_explanation.lower()


# ============================================================================
# Rule R3: Number Mismatch
# ============================================================================

def test_r3_number_mismatch():
    c_claim = Claim(
        id="claim_num_c",
        case_id="case_corr_test",
        source_evidence_id="ev_cap",
        source_kind="caption",
        text="5,000",
        claim_type="number",
        value={"value": 5000.0, "unit": "people"}
    )
    t_claim = Claim(
        id="claim_num_t",
        case_id="case_corr_test",
        source_evidence_id="ev_aud",
        source_kind="transcript",
        text="500",
        claim_type="number",
        value={"value": 500.0, "unit": "people"}
    )
    mismatch_obs = make_obs(
        "obs_num_mismatch_1",
        "ev_cap",
        Modality.text,
        "caption_number_mismatch",
        Strength.moderate,
        details={"caption_quote": "5,000", "transcript_quote": "500", "discrepancy_percent": 90.0}
    )

    evidence_list = [{"id": "ev_cap", "kind": "text"}, {"id": "ev_aud", "kind": "audio"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [mismatch_obs], [c_claim, t_claim])

    r3_edges = [e for e in edges if e.rule == "R3_number_mismatch"]
    assert len(r3_edges) >= 1
    edge = r3_edges[0]
    assert edge.relation == "CONTRADICTS"
    assert edge.strength == Strength.moderate
    assert "5,000" in edge.explanation
    assert "500" in edge.explanation
    assert len(edge.alternative_explanation) > 0
    assert len(edge.evidence_observation_ids) >= 1


# ============================================================================
# Rule R4: Entity Mismatch
# ============================================================================

def test_r4_entity_mismatch():
    c_claim = Claim(id="c_ent", case_id="case_corr_test", source_evidence_id="ev_cap", source_kind="caption", text="Paris", claim_type="entity", value={"label": "GPE"})
    t_claim = Claim(id="t_ent", case_id="case_corr_test", source_evidence_id="ev_aud", source_kind="transcript", text="London", claim_type="entity", value={"label": "GPE"})

    ent_obs = make_obs(
        "obs_ent_conf",
        "ev_cap",
        Modality.text,
        "caption_entity_conflict",
        Strength.weak,
        details={"caption_entity": "Paris", "transcript_entity": "London", "label": "GPE"}
    )

    evidence_list = [{"id": "ev_cap", "kind": "text"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [ent_obs], [c_claim, t_claim])

    r4_edges = [e for e in edges if e.rule == "R4_entity_mismatch"]
    assert len(r4_edges) >= 1
    edge = r4_edges[0]
    assert edge.relation == "CONTRADICTS"
    assert edge.strength == Strength.weak
    assert len(edge.alternative_explanation) > 0


# ============================================================================
# Rule R5: Entity Agreement
# ============================================================================

def test_r5_entity_agreement():
    c_claim = Claim(id="c_nato", case_id="case_corr_test", source_evidence_id="ev_cap", source_kind="caption", text="NATO", claim_type="entity", value={"label": "ORG"})
    t_claim = Claim(id="t_nato", case_id="case_corr_test", source_evidence_id="ev_aud", source_kind="transcript", text="NATO", claim_type="entity", value={"label": "ORG"})

    obs = make_obs("obs_tfidf", "ev_cap", Modality.text, "text_similarity_tfidf", Strength.informational)

    evidence_list = [{"id": "ev_cap", "kind": "text"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [obs], [c_claim, t_nato_claim := t_claim])

    r5_edges = [e for e in edges if e.rule == "R5_entity_agreement"]
    assert len(r5_edges) >= 1
    edge = r5_edges[0]
    assert edge.relation == "SUPPORTS"
    assert edge.strength == Strength.informational
    assert len(edge.evidence_observation_ids) >= 1


# ============================================================================
# Rule R6: Source Reuse
# ============================================================================

def test_r6_source_reuse():
    ev1 = {"id": "ev_orig", "sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "kind": "image"}
    ev2 = {"id": "ev_copy", "sha256": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", "kind": "image"}

    obs = make_obs("obs_orig", "ev_orig", Modality.image, "missing_exif", Strength.informational)

    edges = evaluate_correlation_rules("case_corr_test", [ev1, ev2], [obs], [])

    r6_edges = [e for e in edges if e.rule == "R6_source_reuse"]
    assert len(r6_edges) >= 1
    edge = r6_edges[0]
    assert edge.relation == "DERIVED_FROM"
    assert len(edge.evidence_observation_ids) >= 1


# ============================================================================
# Rule R7: Audio-Visual Cut
# ============================================================================

def test_r7_audio_visual_cut():
    # Video scene cut at 2000 ms + audio discontinuity at 2100 ms on same video
    v_cut = make_obs("obs_v_cut", "ev_vid_1", Modality.video, "video_scene_cut", Strength.informational, time_start_ms=2000, time_end_ms=2050)
    a_disc = make_obs("obs_a_disc", "ev_vid_1", Modality.audio, "audio_discontinuity", Strength.moderate, time_start_ms=2100, time_end_ms=2150)

    evidence_list = [{"id": "ev_vid_1", "kind": "video"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [v_cut, a_disc], [])

    r7_edges = [e for e in edges if e.rule == "R7_audio_visual_cut"]
    assert len(r7_edges) >= 1
    edge = r7_edges[0]
    assert edge.relation == "CO_OCCURS"
    assert edge.strength == Strength.moderate
    # Mandatory phrase per prompt specifications
    assert "Consistent with an edit/splice point, or a normal camera/microphone cut." in edge.explanation
    assert len(edge.alternative_explanation) > 0
    assert len(edge.evidence_observation_ids) >= 1


# ============================================================================
# Rule R8: Unresolved Claim
# ============================================================================

def test_r8_unresolved_claim():
    # Standalone claim without supporting or contradicting counterpart
    orphan_claim = Claim(
        id="claim_orphan",
        case_id="case_corr_test",
        source_evidence_id="ev_txt",
        source_kind="caption",
        text="A secret meeting occurred in the basement.",
        claim_type="statement",
        value={"text": "A secret meeting occurred in the basement."}
    )
    obs = make_obs("obs_anchor", "ev_txt", Modality.text, "text_similarity_tfidf", Strength.informational)

    evidence_list = [{"id": "ev_txt", "kind": "text"}]
    edges = evaluate_correlation_rules("case_corr_test", evidence_list, [obs], [orphan_claim])

    r8_edges = [e for e in edges if e.rule == "R8_unresolved_claim"]
    assert len(r8_edges) >= 1
    edge = r8_edges[0]
    assert edge.relation == "NEEDS_REVIEW"
    assert "not a contradiction" in edge.explanation.lower()
    assert len(edge.evidence_observation_ids) >= 1


# ============================================================================
# Review Priority & Deterministic Strength Triage
# ============================================================================

def test_review_priority_logic():
    # 1. Low priority: only informational
    o_info = make_obs("o1", "e1", Modality.image, "missing_exif", Strength.informational)
    p_low = compute_case_review_priority([o_info], [])
    assert p_low["review_priority"] == "low"
    assert "not a fake probability" in p_low["label"]

    # 2. Medium priority: 1 moderate finding
    o_mod = make_obs("o2", "e1", Modality.image, "copy_move_duplication", Strength.moderate)
    p_med = compute_case_review_priority([o_info, o_mod], [])
    assert p_med["review_priority"] == "medium"

    # 3. High priority: >= 1 strong finding
    o_strong = make_obs("o3", "e1", Modality.image, "deepfake_artifact", Strength.strong)
    p_high = compute_case_review_priority([o_strong], [])
    assert p_high["review_priority"] == "high"

    # 4. High priority: >= 2 moderate findings + 1 CONTRADICTS edge
    o_mod2 = make_obs("o4", "e1", Modality.audio, "audio_discontinuity", Strength.moderate)
    contra_edge = GraphEdge(
        id="e_contra",
        case_id="c",
        src_id="o2",
        dst_id="o4",
        relation="CONTRADICTS",
        rule="R3_number_mismatch",
        evidence_observation_ids=["o2", "o4"],
        explanation="Numbers disagree",
        alternative_explanation="Rounding",
        strength=Strength.moderate
    )
    p_high2 = compute_case_review_priority([o_mod, o_mod2], [contra_edge])
    assert p_high2["review_priority"] == "high"

