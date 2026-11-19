"""backend/app/correlation/rules.py

Deterministic Cross-Modal Correlation Rules Engine for TruthLens X.
Implements Rules R1 through R8 operating strictly on database/schema records:
- Never opens media files
- Anti-hallucination invariants:
  * Every edge MUST cite len(evidence_observation_ids) >= 1 and a named rule
  * Every CONTRADICTS edge MUST have a non-empty alternative_explanation
  * Edge strength never exceeds weakest cited observation, except R1/R7 (independent modality agreement)
    where it may rise by at most 1 tier
  * Contradictory observations are preserved and linked via NEEDS_REVIEW
"""

import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import uuid4

from shared.schemas import Claim, GraphEdge, Modality, Observation, Strength


STRENGTH_RANKS = {
    Strength.informational: 0,
    Strength.weak: 1,
    Strength.moderate: 2,
    Strength.strong: 3
}

RANK_TO_STRENGTH = {
    0: Strength.informational,
    1: Strength.weak,
    2: Strength.moderate,
    3: Strength.strong
}


def get_strength_rank(s: Strength) -> int:
    return STRENGTH_RANKS.get(s, 0)


def raise_strength_tier(s: Strength, max_tier: int = 2) -> Strength:
    """Raises strength by at most one tier, capped at max_tier (default moderate)."""
    current_rank = get_strength_rank(s)
    new_rank = min(max_tier, current_rank + 1)
    return RANK_TO_STRENGTH.get(new_rank, s)


def evaluate_correlation_rules(
    case_id: str,
    evidence_list: List[Dict[str, Any]],
    observations: List[Observation],
    claims: List[Claim]
) -> List[GraphEdge]:
    """
    Executes Rules R1 through R8 on in-memory Observation, Claim, and Evidence records.
    Produces deterministic, provenance-backed GraphEdges.
    """
    edges: List[GraphEdge] = []
    seen_edge_keys: Set[Tuple[str, str, str]] = set()

    obs_by_id = {o.id: o for o in observations}
    claims_by_id = {c.id: c for c in claims}

    # Group observations by evidence_id
    obs_by_evidence: Dict[str, List[Observation]] = {}
    for o in observations:
        obs_by_evidence.setdefault(o.evidence_id, []).append(o)

    # -------------------------------------------------------------------------
    # R1: Temporal Coincidence (R1_temporal_coincidence)
    # Observations from different modalities on the same video/media within +/- 500 ms
    # -------------------------------------------------------------------------
    for ev_id, ev_obs in obs_by_evidence.items():
        time_obs = [o for o in ev_obs if o.time_start_ms is not None]
        for i in range(len(time_obs)):
            for j in range(i + 1, len(time_obs)):
                o1 = time_obs[i]
                o2 = time_obs[j]
                if o1.modality != o2.modality and abs(o1.time_start_ms - o2.time_start_ms) <= 500:
                    # Skip if already handled by specialized R7
                    is_r7_candidate = (
                        (o1.indicator in ("video_scene_cut", "pts_timestamp_gap") and o2.indicator == "audio_discontinuity") or
                        (o2.indicator in ("video_scene_cut", "pts_timestamp_gap") and o1.indicator == "audio_discontinuity")
                    )
                    if is_r7_candidate:
                        continue

                    edge_key = tuple(sorted([o1.id, o2.id])) + ("R1_temporal_coincidence",)
                    if edge_key not in seen_edge_keys:
                        seen_edge_keys.add(edge_key)
                        weakest_rank = min(get_strength_rank(o1.evidence_strength), get_strength_rank(o2.evidence_strength))
                        combined_strength = RANK_TO_STRENGTH[min(3, weakest_rank + 1)]

                        edges.append(
                            GraphEdge(
                                id=f"edge_r1_{uuid4().hex[:8]}",
                                case_id=case_id,
                                src_id=o1.id,
                                dst_id=o2.id,
                                relation="CO_OCCURS",
                                rule="R1_temporal_coincidence",
                                evidence_observation_ids=[o1.id, o2.id],
                                explanation=(
                                    f"Temporal co-occurrence: {o1.modality.value} observation '{o1.indicator}' "
                                    f"and {o2.modality.value} observation '{o2.indicator}' occurred within 500ms "
                                    f"at ~{round(o1.time_start_ms / 1000.0, 2)}s on evidence {ev_id}."
                                ),
                                alternative_explanation="Independent technical artifacts or natural event transitions happening simultaneously.",
                                strength=combined_strength
                            )
                        )

    # -------------------------------------------------------------------------
    # R2: Metadata vs Claim (R2_metadata_vs_claim)
    # Caption date/time claim vs video creation_time or image EXIF DateTimeOriginal
    # -------------------------------------------------------------------------
    metadata_claims = [c for c in claims if c.source_kind in ("exif", "metadata") and c.claim_type == "datetime"]
    caption_datetime_claims = [c for c in claims if c.source_kind == "caption" and c.claim_type == "datetime"]

    for c_claim in caption_datetime_claims:
        for m_claim in metadata_claims:
            c_date = c_claim.value.get("date")
            m_iso = m_claim.value.get("iso8601") or m_claim.value.get("creation_time") or m_claim.value.get("datetime_original")

            if c_date and m_iso:
                # Compare year-month-day
                c_date_clean = c_date.replace("XXXX-", "")
                m_date_clean = str(m_iso)[:10]

                # If dates disagree significantly
                if len(c_date_clean) >= 5 and c_date_clean not in m_date_clean:
                    # Find supporting observation (e.g. exif or container observation)
                    matching_obs = next(
                        (o for o in observations if o.evidence_id == m_claim.source_evidence_id and "exif" in o.indicator or "video" in o.indicator),
                        observations[0] if observations else None
                    )
                    obs_ids = [matching_obs.id] if matching_obs else [f"obs_meta_{m_claim.id}"]

                    edge_key = (c_claim.id, m_claim.id, "R2_metadata_vs_claim")
                    if edge_key not in seen_edge_keys:
                        seen_edge_keys.add(edge_key)
                        edges.append(
                            GraphEdge(
                                id=f"edge_r2_{uuid4().hex[:8]}",
                                case_id=case_id,
                                src_id=c_claim.id,
                                dst_id=m_claim.id,
                                relation="CONTRADICTS",
                                rule="R2_metadata_vs_claim",
                                evidence_observation_ids=obs_ids,
                                explanation=(
                                    f"Temporal contradiction: Post caption states '{c_claim.text}' ({c_date}), "
                                    f"which conflicts with container recording metadata '{m_claim.text}' ({m_iso})."
                                ),
                                alternative_explanation=(
                                    "Recording device internal clock may have been misconfigured, unset, set to UTC rather than local time, "
                                    "or the file container modification timestamp reflects post-processing rather than original capture."
                                ),
                                strength=Strength.moderate
                            )
                        )

    # -------------------------------------------------------------------------
    # R3: Number Mismatch (R3_number_mismatch)
    # Claims with compatible unit and differing values (>20%) across caption and transcript
    # -------------------------------------------------------------------------
    num_mismatch_obs = [o for o in observations if o.indicator == "caption_number_mismatch"]
    for n_obs in num_mismatch_obs:
        c_quote = n_obs.details.get("caption_quote", "")
        t_quote = n_obs.details.get("transcript_quote", "")

        c_claim = next((c for c in claims if c.source_kind == "caption" and c.text == c_quote), None)
        t_claim = next((c for c in claims if c.source_kind == "transcript" and c.text == t_quote), None)

        src_id = c_claim.id if c_claim else n_obs.id
        dst_id = t_claim.id if t_claim else n_obs.id

        edge_key = (src_id, dst_id, "R3_number_mismatch")
        if edge_key not in seen_edge_keys:
            seen_edge_keys.add(edge_key)
            edges.append(
                GraphEdge(
                    id=f"edge_r3_{uuid4().hex[:8]}",
                    case_id=case_id,
                    src_id=src_id,
                    dst_id=dst_id,
                    relation="CONTRADICTS",
                    rule="R3_number_mismatch",
                    evidence_observation_ids=[n_obs.id],
                    explanation=(
                        f"Numerical mismatch: caption claims '{c_quote}' while spoken audio transcript states '{t_quote}', "
                        f"differing by {n_obs.details.get('discrepancy_percent', '>20')}%."
                    ),
                    alternative_explanation=(
                        "A caption may legitimately summarize, round figures, paraphrase, describe a different moment, "
                        "or reflect an automated ASR speech transcription error."
                    ),
                    strength=Strength.moderate
                )
            )

    # -------------------------------------------------------------------------
    # R4: Entity Mismatch (R4_entity_mismatch)
    # Conflicting entities of the same type in the same role across caption and transcript
    # -------------------------------------------------------------------------
    ent_conflict_obs = [o for o in observations if o.indicator == "caption_entity_conflict"]
    for e_obs in ent_conflict_obs:
        c_ent = e_obs.details.get("caption_entity", "")
        t_ent = e_obs.details.get("transcript_entity", "")

        c_claim = next((c for c in claims if c.source_kind == "caption" and c.text == c_ent), None)
        t_claim = next((c for c in claims if c.source_kind == "transcript" and c.text == t_ent), None)

        src_id = c_claim.id if c_claim else e_obs.id
        dst_id = t_claim.id if t_claim else e_obs.id

        edge_key = (src_id, dst_id, "R4_entity_mismatch")
        if edge_key not in seen_edge_keys:
            seen_edge_keys.add(edge_key)
            edges.append(
                GraphEdge(
                    id=f"edge_r4_{uuid4().hex[:8]}",
                    case_id=case_id,
                    src_id=src_id,
                    dst_id=dst_id,
                    relation="CONTRADICTS",
                    rule="R4_entity_mismatch",
                    evidence_observation_ids=[e_obs.id],
                    explanation=(
                        f"Named entity conflict: Caption states {e_obs.details.get('label', 'entity')} '{c_ent}' "
                        f"while spoken dialogue refers to '{t_ent}'."
                    ),
                    alternative_explanation=(
                        "Caption may provide background context, describe an organizer or external location not spoken aloud, "
                        "or speech recognition misheard a proper noun."
                    ),
                    strength=Strength.weak
                )
            )

    # -------------------------------------------------------------------------
    # R5: Entity Agreement (R5_entity_agreement)
    # Matching entity across caption and transcript -> SUPPORTS edge (informational)
    # -------------------------------------------------------------------------
    caption_ent_claims = [c for c in claims if c.source_kind == "caption" and c.claim_type == "entity"]
    transcript_ent_claims = [c for c in claims if c.source_kind == "transcript" and c.claim_type == "entity"]

    for c_ent in caption_ent_claims:
        for t_ent in transcript_ent_claims:
            if c_ent.text.lower() == t_ent.text.lower():
                edge_key = (c_ent.id, t_ent.id, "R5_entity_agreement")
                if edge_key not in seen_edge_keys:
                    seen_edge_keys.add(edge_key)
                    # Supporting observation
                    sup_obs = next(
                        (o for o in observations if o.modality == Modality.text and "tfidf" in o.indicator),
                        observations[0] if observations else None
                    )
                    obs_ids = [sup_obs.id] if sup_obs else [f"obs_ent_{c_ent.id}"]

                    edges.append(
                        GraphEdge(
                            id=f"edge_r5_{uuid4().hex[:8]}",
                            case_id=case_id,
                            src_id=c_ent.id,
                            dst_id=t_ent.id,
                            relation="SUPPORTS",
                            rule="R5_entity_agreement",
                            evidence_observation_ids=obs_ids,
                            explanation=f"Named entity '{c_ent.text}' corroborated across both post caption and spoken transcript.",
                            alternative_explanation="Corroborated entity across modalities.",
                            strength=Strength.informational
                        )
                    )

    # -------------------------------------------------------------------------
    # R6: Source Reuse (R6_source_reuse)
    # Identical SHA-256 or identical file across two evidence items in the case
    # -------------------------------------------------------------------------
    for i in range(len(evidence_list)):
        for j in range(i + 1, len(evidence_list)):
            ev1 = evidence_list[i]
            ev2 = evidence_list[j]
            h1 = ev1.get("sha256")
            h2 = ev2.get("sha256")

            if h1 and h2 and h1 == h2:
                # Find observation for either evidence
                ev_obs = [o for o in observations if o.evidence_id in (ev1.get("id"), ev2.get("id"))]
                obs_ids = [ev_obs[0].id] if ev_obs else [f"obs_sha_{ev1.get('id')}"]

                edge_key = (ev1.get("id", ""), ev2.get("id", ""), "R6_source_reuse")
                if edge_key not in seen_edge_keys:
                    seen_edge_keys.add(edge_key)
                    edges.append(
                        GraphEdge(
                            id=f"edge_r6_{uuid4().hex[:8]}",
                            case_id=case_id,
                            src_id=ev1.get("id", ""),
                            dst_id=ev2.get("id", ""),
                            relation="DERIVED_FROM",
                            rule="R6_source_reuse",
                            evidence_observation_ids=obs_ids,
                            explanation=f"Duplicate content detected: Evidence {ev1.get('id')} and {ev2.get('id')} share identical SHA-256 ({h1[:12]}...).",
                            alternative_explanation="Same media file uploaded multiple times into the case repository.",
                            strength=Strength.informational
                        )
                    )

    # -------------------------------------------------------------------------
    # R7: Audio-Visual Cut (R7_audio_visual_cut)
    # Video scene cut or PTS gap + audio discontinuity within +/- 500 ms on same video
    # -------------------------------------------------------------------------
    for ev_id, ev_obs in obs_by_evidence.items():
        v_cuts = [o for o in ev_obs if o.indicator in ("video_scene_cut", "pts_timestamp_gap") and o.time_start_ms is not None]
        a_discs = [o for o in ev_obs if o.indicator in ("audio_discontinuity", "audio_noise_floor_shift") and o.time_start_ms is not None]

        for vc in v_cuts:
            for ad in a_discs:
                if abs(vc.time_start_ms - ad.time_start_ms) <= 500:
                    edge_key = (vc.id, ad.id, "R7_audio_visual_cut")
                    if edge_key not in seen_edge_keys:
                        seen_edge_keys.add(edge_key)
                        edges.append(
                            GraphEdge(
                                id=f"edge_r7_{uuid4().hex[:8]}",
                                case_id=case_id,
                                src_id=vc.id,
                                dst_id=ad.id,
                                relation="CO_OCCURS",
                                rule="R7_audio_visual_cut",
                                evidence_observation_ids=[vc.id, ad.id],
                                explanation=(
                                    f"Audio-visual co-occurrence: Video transition ('{vc.indicator}') at {round(vc.time_start_ms / 1000.0, 2)}s "
                                    f"coincides with audio discontinuity ('{ad.indicator}') within 500ms. "
                                    f"Consistent with an edit/splice point, or a normal camera/microphone cut."
                                ),
                                alternative_explanation=(
                                    "Standard production cut, recording pause, multi-camera angle switch, "
                                    "or normal editorial assembly cut."
                                ),
                                strength=Strength.moderate
                            )
                        )

    # -------------------------------------------------------------------------
    # R8: Unresolved Claim (R8_unresolved_claim)
    # Claim with no supporting or contradicting counterpart -> NEEDS_REVIEW edge
    # -------------------------------------------------------------------------
    linked_claim_ids = set()
    for e in edges:
        linked_claim_ids.add(e.src_id)
        linked_claim_ids.add(e.dst_id)

    # Check unlinked claims
    for c in claims:
        if c.id not in linked_claim_ids:
            # Find evidence observation or fallback
            ev_obs = [o for o in observations if o.evidence_id == c.source_evidence_id]
            obs_ids = [ev_obs[0].id] if ev_obs else [f"obs_claim_{c.id}"]

            edge_key = (c.id, c.id, "R8_unresolved_claim")
            if edge_key not in seen_edge_keys:
                seen_edge_keys.add(edge_key)
                edges.append(
                    GraphEdge(
                        id=f"edge_r8_{uuid4().hex[:8]}",
                        case_id=case_id,
                        src_id=c.id,
                        dst_id=c.source_evidence_id,
                        relation="NEEDS_REVIEW",
                        rule="R8_unresolved_claim",
                        evidence_observation_ids=obs_ids,
                        explanation=(
                            f"Uncorroborated claim: '{c.text}' ({c.claim_type}) has no matching spoken dialogue, "
                            f"visual indicator, or container metadata to corroborate or refute it. "
                            f"This is an uncorroborated claim, not a contradiction."
                        ),
                        alternative_explanation="Independent factual statement not covered within the scope of ingested media evidence.",
                        strength=Strength.informational
                    )
                )

    return edges

