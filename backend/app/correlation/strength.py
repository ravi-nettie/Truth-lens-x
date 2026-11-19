"""backend/app/correlation/strength.py

Deterministic Evidence Strength and Review Priority Aggregator for TruthLens X.
Adheres strictly to Rule 2:
- NEVER computes or displays a 'fake probability', deepfake percentage, or accuracy score
- Explicitly labelled as 'review_priority (not a fake probability)'
- Formula is transparent, deterministic, and printed verbatim in API responses and reports
"""

from typing import Any, Dict, List
from shared.schemas import GraphEdge, Observation, Strength


FORMULA_EXPLANATION = (
    "Deterministic Review-Priority Logic: "
    "'high' if (>=1 'strong' observation) OR (>=2 'moderate' observations AND >=1 'CONTRADICTS' edge); "
    "'medium' if (>=1 'moderate' observation) OR (>=1 'CONTRADICTS' edge); "
    "else 'low'. "
    "Review priority is a triage indicator for human reviewers, NOT a probability of falsehood."
)


def compute_case_review_priority(
    observations: List[Observation],
    edges: List[GraphEdge]
) -> Dict[str, Any]:
    """
    Computes deterministic triage review_priority based strictly on observation and edge counts.
    """
    counts = {
        "strong": sum(1 for o in observations if o.evidence_strength == Strength.strong),
        "moderate": sum(1 for o in observations if o.evidence_strength == Strength.moderate),
        "weak": sum(1 for o in observations if o.evidence_strength == Strength.weak),
        "informational": sum(1 for o in observations if o.evidence_strength == Strength.informational),
        "contradictions": sum(1 for e in edges if e.relation == "CONTRADICTS"),
        "total_observations": len(observations),
        "total_edges": len(edges)
    }

    # Evaluate explicit formula
    if counts["strong"] >= 1 or (counts["moderate"] >= 2 and counts["contradictions"] >= 1):
        priority = "high"
        reason = "At least 1 strong observation or multiple moderate observations with cross-modal contradiction."
    elif counts["moderate"] >= 1 or counts["contradictions"] >= 1:
        priority = "medium"
        reason = "At least 1 moderate observation or cross-modal contradiction requiring review."
    else:
        priority = "low"
        reason = "All observations are weak or informational; no cross-modal contradictions detected."

    return {
        "review_priority": priority,
        "label": "review_priority (not a fake probability)",
        "priority_reason": reason,
        "formula": FORMULA_EXPLANATION,
        "counts": counts
    }

