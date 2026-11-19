"""backend/app/correlation/graph.py

Provenance and Forensic Correlation Graph Builder for TruthLens X.
Generates typed GraphNode and GraphEdge collections for visual graph rendering.
"""

from typing import Any, Dict, List
from shared.schemas import Claim, GraphEdge, GraphNode, GraphResponse, Modality, Observation, Strength


def build_case_graph(
    case_id: str,
    evidence_list: List[Dict[str, Any]],
    observations: List[Observation],
    claims: List[Claim],
    edges: List[GraphEdge]
) -> GraphResponse:
    """
    Constructs the complete case correlation graph with evidence, observation,
    claim, entity, and anchor nodes.
    """
    nodes: List[GraphNode] = []
    seen_node_ids = set()

    # 1. Evidence Nodes
    for ev in evidence_list:
        ev_id = ev.get("id")
        if ev_id and ev_id not in seen_node_ids:
            seen_node_ids.add(ev_id)
            kind_str = ev.get("kind", "evidence")
            modality = None
            if kind_str in ("image", "video", "audio", "text"):
                modality = Modality(kind_str)

            nodes.append(
                GraphNode(
                    id=ev_id,
                    label=ev.get("original_name") or ev_id,
                    kind="evidence",
                    modality=modality,
                    details={
                        "sha256": ev.get("sha256", ""),
                        "size_bytes": ev.get("size_bytes", 0),
                        "mime": ev.get("mime", "")
                    }
                )
            )

    # 2. Observation Nodes
    for obs in observations:
        if obs.id not in seen_node_ids:
            seen_node_ids.add(obs.id)
            nodes.append(
                GraphNode(
                    id=obs.id,
                    label=f"[{obs.evidence_strength.value.upper()}] {obs.summary[:40]}",
                    kind="observation",
                    modality=obs.modality,
                    strength=obs.evidence_strength,
                    details={
                        "indicator": obs.indicator,
                        "method": obs.method,
                        "time_start_ms": obs.time_start_ms,
                        "time_end_ms": obs.time_end_ms
                    }
                )
            )

    # 3. Claim Nodes
    for cl in claims:
        if cl.id not in seen_node_ids:
            seen_node_ids.add(cl.id)
            nodes.append(
                GraphNode(
                    id=cl.id,
                    label=f"Claim: {cl.text[:40]}",
                    kind="claim",
                    details={
                        "claim_type": cl.claim_type,
                        "source_kind": cl.source_kind,
                        "source_evidence_id": cl.source_evidence_id,
                        "value": cl.value
                    }
                )
            )

    return GraphResponse(
        case_id=case_id,
        nodes=nodes,
        edges=edges
    )

