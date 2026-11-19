"""backend/app/analyzers/text/compare.py

Forensic Cross-Modal Comparison between Text Captions and Audio Transcripts.
Adheres strictly to Rule 2:
- Hard cap: Text-only mismatches never exceed 'moderate' strength
- Quotes exact spans from both caption and transcript in explanation
- Plain-language alternative explanation and limitations on all observations
- Computes TF-IDF cosine similarity reported as strictly informational with NO verdict
- Pure functional design, no DB access, no unhandled exceptions
"""

from collections import Counter
import math
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from shared.schemas import Claim, Modality, Observation, Strength


TEXT_BENIGN_ALTERNATIVE = (
    "A caption may legitimately summarize, paraphrase, refer to background context, "
    "describe a different moment in the event, or reflect an ASR speech transcription error."
)

TEXT_LIMITATIONS = (
    "Text and transcript comparison relies on automated entity and number parsing. "
    "Semantic discrepancies between spoken speech and descriptive headlines are common "
    "in authentic editorial journalism and do not prove intentional deception."
)


def compute_tfidf_cosine_similarity(text1: str, text2: str) -> float:
    """
    Computes deterministic TF-IDF cosine similarity between two texts.
    Returns float in range [0.0, 1.0].
    """
    def tokenize(s: str) -> List[str]:
        return re.findall(r"\b[a-zA-Z0-9]+\b", s.lower())

    tokens1 = tokenize(text1)
    tokens2 = tokenize(text2)

    if not tokens1 or not tokens2:
        return 0.0

    counts1 = Counter(tokens1)
    counts2 = Counter(tokens2)
    vocab = set(counts1.keys()).union(set(counts2.keys()))

    N = 2.0
    dot_prod = 0.0
    norm1_sq = 0.0
    norm2_sq = 0.0

    for term in vocab:
        df = (1 if term in counts1 else 0) + (1 if term in counts2 else 0)
        idf = math.log((1.0 + N) / (1.0 + df)) + 1.0

        tf1 = counts1.get(term, 0)
        tf2 = counts2.get(term, 0)

        w1 = tf1 * idf
        w2 = tf2 * idf

        dot_prod += w1 * w2
        norm1_sq += w1 * w1
        norm2_sq += w2 * w2

    if norm1_sq <= 0 or norm2_sq <= 0:
        return 0.0

    sim = dot_prod / (math.sqrt(norm1_sq) * math.sqrt(norm2_sq))
    return round(float(min(1.0, max(0.0, sim))), 4)


def compare_caption_and_transcript(
    case_id: str,
    evidence_id: str,
    caption_text: str,
    transcript_text: str,
    caption_claims: List[Claim],
    transcript_claims: List[Claim]
) -> Tuple[List[Observation], Dict[str, Any]]:
    """
    Performs forensic comparison of caption against transcript claims.
    """
    observations: List[Observation] = []
    comparison_meta: Dict[str, Any] = {
        "caption_length": len(caption_text),
        "transcript_length": len(transcript_text),
        "tfidf_cosine_similarity": 0.0,
        "mismatches_found": 0,
    }

    # 1. TF-IDF Cosine Similarity (Strictly informational with NO verdict)
    tfidf_sim = compute_tfidf_cosine_similarity(caption_text, transcript_text)
    comparison_meta["tfidf_cosine_similarity"] = tfidf_sim

    observations.append(
        Observation(
            id=f"obs_text_tfidf_{uuid4().hex[:8]}",
            case_id=case_id,
            evidence_id=evidence_id,
            modality=Modality.text,
            indicator="text_similarity_tfidf",
            method="tfidf_cosine_similarity",
            summary=f"Caption and transcript text overlap metric: {round(tfidf_sim * 100, 1)}%",
            explanation=(
                f"TF-IDF cosine similarity between the post caption and spoken transcript is "
                f"{tfidf_sim} (on a scale of 0.0 to 1.0). This metric measures lexical vocabulary overlap "
                f"and carries no automated verdict or credibility assessment."
            ),
            alternative_explanation=TEXT_BENIGN_ALTERNATIVE,
            evidence_strength=Strength.informational,
            limitations=TEXT_LIMITATIONS,
            details={"tfidf_similarity": tfidf_sim}
        )
    )

    # 1b. Optional Dense Semantic Similarity (all-MiniLM-L6-v2, if ENABLE_OPTIONAL_MODELS=true)
    from backend.app.analyzers.text.semantic import (
        compute_semantic_similarity,
        create_semantic_similarity_observation
    )
    sem_status, sem_sim, sem_meta = compute_semantic_similarity(caption_text, transcript_text)
    if sem_status == "done" and sem_sim is not None:
        comparison_meta["semantic_cosine_similarity"] = sem_sim
        observations.append(
            create_semantic_similarity_observation(case_id, evidence_id, sem_sim, sem_meta)
        )

    caption_nums = [c for c in caption_claims if c.claim_type == "number"]
    transcript_nums = [c for c in transcript_claims if c.claim_type == "number"]

    caption_times = [c for c in caption_claims if c.claim_type == "datetime"]
    transcript_times = [c for c in transcript_claims if c.claim_type == "datetime"]

    caption_ents = [c for c in caption_claims if c.claim_type == "entity"]
    transcript_ents = [c for c in transcript_claims if c.claim_type == "entity"]

    # 2. Number Mismatch Check (> 20% difference on compatible units)
    for c_num in caption_nums:
        c_val = float(c_num.value.get("value", 0))
        c_unit = c_num.value.get("unit", "count")
        c_raw = c_num.text

        for t_num in transcript_nums:
            t_val = float(t_num.value.get("value", 0))
            t_unit = t_num.value.get("unit", "count")
            t_raw = t_num.text

            # Compatible units (e.g. both people/count or same unit)
            units_compatible = (c_unit == t_unit) or (c_unit in ("people", "count") and t_unit in ("people", "count"))
            if units_compatible and max(c_val, t_val) > 0:
                diff_ratio = abs(c_val - t_val) / max(c_val, t_val)
                if diff_ratio > 0.20:
                    comparison_meta["mismatches_found"] += 1
                    observations.append(
                        Observation(
                            id=f"obs_num_mismatch_{uuid4().hex[:8]}",
                            case_id=case_id,
                            evidence_id=evidence_id,
                            modality=Modality.text,
                            indicator="caption_number_mismatch",
                            method="cross_modal_numerical_comparison",
                            summary=f"Numerical discrepancy: caption states '{c_raw}' vs transcript '{t_raw}'",
                            explanation=(
                                f"Post caption claims '{c_raw}' ({c_val} {c_unit}) while the spoken audio transcript states "
                                f"'{t_raw}' ({t_val} {t_unit}), representing a {round(diff_ratio * 100, 1)}% discrepancy."
                            ),
                            alternative_explanation=TEXT_BENIGN_ALTERNATIVE,
                            evidence_strength=Strength.moderate,
                            limitations=TEXT_LIMITATIONS,
                            details={
                                "caption_quote": c_raw,
                                "caption_value": c_val,
                                "transcript_quote": t_raw,
                                "transcript_value": t_val,
                                "discrepancy_percent": round(diff_ratio * 100, 1)
                            }
                        )
                    )

    # 3. Time / Day Mismatch Check (> 30 min difference or conflicting weekday/daypart)
    for c_time in caption_times:
        c_raw = c_time.text
        c_wd = c_time.value.get("weekday")
        c_dp = c_time.value.get("daypart")
        c_hour = c_time.value.get("hour")
        c_min = c_time.value.get("minute")
        if c_hour is None and c_time.value.get("time"):
            try:
                parts = c_time.value["time"].split(":")
                c_hour, c_min = int(parts[0]), int(parts[1])
            except Exception:
                pass

        for t_time in transcript_times:
            t_raw = t_time.text
            t_wd = t_time.value.get("weekday")
            t_dp = t_time.value.get("daypart")
            t_hour = t_time.value.get("hour")
            t_min = t_time.value.get("minute")
            if t_hour is None and t_time.value.get("time"):
                try:
                    parts = t_time.value["time"].split(":")
                    t_hour, t_min = int(parts[0]), int(parts[1])
                except Exception:
                    pass

            mismatch_reason = None

            # Weekday conflict: e.g. Saturday vs Friday
            if c_wd and t_wd and c_wd.lower() != t_wd.lower():
                mismatch_reason = f"conflicting weekdays (caption '{c_wd}' vs transcript '{t_wd}')"

            # Time of day difference > 30 minutes
            elif c_hour is not None and t_hour is not None:
                c_total_mins = c_hour * 60 + (c_min or 0)
                t_total_mins = t_hour * 60 + (t_min or 0)
                if abs(c_total_mins - t_total_mins) > 30:
                    mismatch_reason = (
                        f"time difference of {abs(c_total_mins - t_total_mins)} minutes "
                        f"(caption '{c_raw}' vs transcript '{t_raw}')"
                    )

            # Daypart conflict (e.g. morning vs night, afternoon vs evening)
            elif c_dp and t_dp and c_dp != t_dp:
                incompatible_dayparts = {
                    ("morning", "night"), ("night", "morning"),
                    ("morning", "evening"), ("evening", "morning"),
                    ("afternoon", "night"), ("night", "afternoon")
                }
                if (c_dp, t_dp) in incompatible_dayparts:
                    mismatch_reason = f"conflicting time of day (caption '{c_dp}' vs transcript '{t_dp}')"

            if mismatch_reason:
                comparison_meta["mismatches_found"] += 1
                observations.append(
                    Observation(
                        id=f"obs_time_mismatch_{uuid4().hex[:8]}",
                        case_id=case_id,
                        evidence_id=evidence_id,
                        modality=Modality.text,
                        indicator="caption_time_mismatch",
                        method="cross_modal_temporal_comparison",
                        summary=f"Temporal discrepancy: caption '{c_raw}' vs transcript '{t_raw}'",
                        explanation=(
                            f"Post caption states '{c_raw}' while the spoken dialogue in the transcript states "
                            f"'{t_raw}', exhibiting {mismatch_reason}."
                        ),
                        alternative_explanation=TEXT_BENIGN_ALTERNATIVE,
                        evidence_strength=Strength.moderate,
                        limitations=TEXT_LIMITATIONS,
                        details={
                            "caption_quote": c_raw,
                            "transcript_quote": t_raw,
                            "mismatch_reason": mismatch_reason
                        }
                    )
                )

    # 4. Entity Comparison (Caption Entity Absent / Conflicting)
    transcript_entity_names = {e.text.lower() for e in transcript_ents}
    transcript_full_lower = transcript_text.lower()

    for c_ent in caption_ents:
        c_text = c_ent.text
        c_label = c_ent.value.get("label", "ENTITY")
        c_lower = c_text.lower()

        # Check if entity is mentioned in transcript text
        if c_lower not in transcript_full_lower:
            # Check if transcript contains a conflicting entity of the same type
            conflicting_ent = next(
                (te for te in transcript_ents if te.value.get("label") == c_label and te.text.lower() != c_lower),
                None
            )

            if conflicting_ent:
                comparison_meta["mismatches_found"] += 1
                observations.append(
                    Observation(
                        id=f"obs_ent_conflict_{uuid4().hex[:8]}",
                        case_id=case_id,
                        evidence_id=evidence_id,
                        modality=Modality.text,
                        indicator="caption_entity_conflict",
                        method="cross_modal_entity_comparison",
                        summary=f"Entity conflict: caption '{c_text}' ({c_label}) vs transcript '{conflicting_ent.text}'",
                        explanation=(
                            f"Caption names {c_label} '{c_text}' while the audio transcript refers to "
                            f"different {c_label} '{conflicting_ent.text}'."
                        ),
                        alternative_explanation=TEXT_BENIGN_ALTERNATIVE,
                        evidence_strength=Strength.weak,
                        limitations=TEXT_LIMITATIONS,
                        details={"caption_entity": c_text, "transcript_entity": conflicting_ent.text, "label": c_label}
                    )
                )
            else:
                observations.append(
                    Observation(
                        id=f"obs_ent_absent_{uuid4().hex[:8]}",
                        case_id=case_id,
                        evidence_id=evidence_id,
                        modality=Modality.text,
                        indicator="caption_entity_absent_from_audio",
                        method="cross_modal_entity_comparison",
                        summary=f"Caption entity '{c_text}' ({c_label}) not mentioned in audio transcript",
                        explanation=(
                            f"The entity '{c_text}' appears in the post caption but was not explicitly mentioned "
                            f"in the spoken dialogue of the audio track."
                        ),
                        alternative_explanation="Social media captions routinely supply background context, location, or subject identities not spoken out loud in short clips.",
                        evidence_strength=Strength.informational,
                        limitations="Absence of spoken mention is typical of brief documentary clips or contextual journalism.",
                        details={"caption_entity": c_text, "label": c_label}
                    )
                )

    return observations, comparison_meta
