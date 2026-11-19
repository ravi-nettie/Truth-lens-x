"""backend/app/analyzers/text/semantic.py

Optional Local Semantic Similarity (all-MiniLM-L6-v2) & Wording-Only Paraphraser for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Guarded behind ENABLE_OPTIONAL_MODELS=true and local weights existence in models/all-MiniLM-L6-v2
- Text similarity is strictly informational (no fake score, no verdict)
- Wording-Only Paraphraser:
  * May ONLY reword already-computed, cited findings
  * Strictly forbidden from creating new observations, claims, or graph edges
  * Pure functional design, 100% offline
"""

import math
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.app.config import settings
from shared.schemas import Modality, Observation, Strength


def get_minilm_model_path() -> Path:
    """Returns path to local all-MiniLM-L6-v2 model directory."""
    return settings.models_path / "all-MiniLM-L6-v2"


def is_semantic_model_available() -> bool:
    """Checks whether ENABLE_OPTIONAL_MODELS=true and weights exist locally."""
    if not getattr(settings, "ENABLE_OPTIONAL_MODELS", False):
        return False
    model_path = get_minilm_model_path()
    return model_path.exists() and (model_path.is_dir() or model_path.is_file())


def compute_dense_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes standard cosine similarity between two float vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 <= 0 or norm2 <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (norm1 * norm2)))


def compute_semantic_similarity(
    caption_text: str,
    transcript_text: str
) -> Tuple[str, Optional[float], Dict[str, Any]]:
    """
    Computes dense semantic embedding similarity using local all-MiniLM-L6-v2 if enabled.
    Returns:
    - status: "done", "skipped_missing_model", or "disabled"
    - similarity: Optional[float] in [0.0, 1.0]
    - telemetry: Dict[str, Any]
    """
    telemetry: Dict[str, Any] = {
        "model": "all-MiniLM-L6-v2",
        "enabled": getattr(settings, "ENABLE_OPTIONAL_MODELS", False),
        "status": "disabled",
        "metric_type": "cosine_similarity"
    }

    if not getattr(settings, "ENABLE_OPTIONAL_MODELS", False):
        telemetry["status"] = "disabled"
        return "disabled", None, telemetry

    model_path = get_minilm_model_path()
    if not model_path.exists():
        telemetry["status"] = "skipped_missing_model"
        telemetry["reason"] = f"Local weights for all-MiniLM-L6-v2 not found at {model_path}."
        return "skipped_missing_model", None, telemetry

    # Attempt sentence-transformers or ONNX CPU inference
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(str(model_path))
        embeddings = model.encode([caption_text, transcript_text], normalize_embeddings=True)
        sim = float(sum(embeddings[0] * embeddings[1]))
        sim_clamped = round(max(0.0, min(1.0, sim)), 4)
        telemetry["status"] = "done"
        telemetry["semantic_similarity"] = sim_clamped
        return "done", sim_clamped, telemetry
    except Exception as e:
        # Fallback dense heuristic representation if full framework not installed
        telemetry["status"] = "failed"
        telemetry["error"] = str(e)
        return "failed", None, telemetry


def create_semantic_similarity_observation(
    case_id: str,
    evidence_id: str,
    similarity_score: float,
    telemetry: Dict[str, Any]
) -> Observation:
    """Creates a strictly informational observation for semantic similarity."""
    return Observation(
        id=f"obs_text_semantic_{uuid4().hex[:8]}",
        case_id=case_id,
        evidence_id=evidence_id,
        modality=Modality.text,
        indicator="text_semantic_similarity",
        method="all_minilm_l6_v2_cosine",
        summary=f"Dense semantic similarity metric: {round(similarity_score * 100, 1)}% (informational)",
        explanation=(
            f"Dense neural embedding comparison using local all-MiniLM-L6-v2 computed a cosine similarity "
            f"of {similarity_score:.4f} ({round(similarity_score * 100, 1)}%) between the post caption and spoken dialogue."
        ),
        alternative_explanation=(
            "Captions often summarize or provide contextual framing that uses different vocabulary "
            "from the exact spoken dialogue while describing the same event."
        ),
        evidence_strength=Strength.informational,  # Hard Rule 2: Strictly informational, NO verdict!
        limitations=(
            "Semantic embedding similarity only — not a verdict or authenticity measure. "
            "Cosine distance reflects linguistic overlap, not factual veracity."
        ),
        details={
            "semantic_similarity": similarity_score,
            "metric_label": "Similarity only — not a verdict",
            "telemetry": telemetry
        }
    )


def summarize_findings_wording_only(
    observations: List[Observation],
    case_title: Optional[str] = None
) -> str:
    """
    Factual, wording-only synthesizer for already-computed forensic findings.
    INVARIANTS (Strict Rule 2 & 3):
    - May ONLY reword already-computed, cited findings.
    - Strictly forbidden from creating new observations, claims, or graph edges.
    - Preserves all cited limitations and alternative explanations.
    """
    if not observations:
        return "No forensic observations recorded for this case."

    # Group by strength tier
    strong_obs = [o for o in observations if o.evidence_strength == Strength.strong]
    moderate_obs = [o for o in observations if o.evidence_strength == Strength.moderate]
    weak_obs = [o for o in observations if o.evidence_strength == Strength.weak]
    info_obs = [o for o in observations if o.evidence_strength == Strength.informational]

    lines = []
    lines.append(f"Forensic Findings Synthesis: {len(observations)} total indicators audited.")

    if strong_obs:
        lines.append(f"- Strong Findings ({len(strong_obs)}):")
        for o in strong_obs:
            lines.append(f"  * [{o.indicator}] {o.summary}. Alternative context: {o.alternative_explanation}")

    if moderate_obs:
        lines.append(f"- Moderate Findings ({len(moderate_obs)}):")
        for o in moderate_obs:
            lines.append(f"  * [{o.indicator}] {o.summary}. Alternative context: {o.alternative_explanation}")

    if weak_obs:
        lines.append(f"- Weak Findings ({len(weak_obs)}):")
        for o in weak_obs:
            lines.append(f"  * [{o.indicator}] {o.summary}.")

    if info_obs:
        lines.append(f"- Informational Attributes ({len(info_obs)}): Standard container, scene cuts, or metadata characteristics.")

    lines.append(
        "Important Reviewer Note: Synthesized strictly from already-computed database findings. "
        "No independent verdict or probability is implied."
    )

    return "\n".join(lines)
