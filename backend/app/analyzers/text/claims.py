"""backend/app/analyzers/text/claims.py

Factual claim synthesis for TruthLens X.
Converts extracted numbers, times, and entities into structured Claim objects
for both captions (source_kind="caption") and transcript segments (source_kind="transcript").
"""

from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from shared.schemas import Claim
from backend.app.analyzers.text.numbers import extract_numbers
from backend.app.analyzers.text.times import extract_times
from backend.app.analyzers.text.entities import extract_entities


def text_to_claims(
    case_id: str,
    source_evidence_id: str,
    text: str,
    source_kind: Literal["caption", "transcript"] = "caption",
    time_start_ms: Optional[int] = None,
    time_end_ms: Optional[int] = None
) -> List[Claim]:
    """
    Extracts numbers, temporal expressions, and named entities from text
    and synthesizes Claim objects.
    """
    claims: List[Claim] = []
    if not text or not text.strip():
        return claims

    # 1. Number Claims
    numbers = extract_numbers(text)
    for n in numbers:
        claims.append(
            Claim(
                id=f"claim_num_{uuid4().hex[:8]}",
                case_id=case_id,
                source_evidence_id=source_evidence_id,
                source_kind=source_kind,
                text=n["raw"],
                claim_type="number",
                value={
                    "value": n["value"],
                    "unit": n["unit"],
                    "raw": n["raw"],
                    "span": list(n["span"])
                },
                time_start_ms=time_start_ms,
                time_end_ms=time_end_ms
            )
        )

    # 2. DateTime Claims
    times = extract_times(text)
    for t in times:
        claims.append(
            Claim(
                id=f"claim_time_{uuid4().hex[:8]}",
                case_id=case_id,
                source_evidence_id=source_evidence_id,
                source_kind=source_kind,
                text=t["raw"],
                claim_type="datetime",
                value={
                    "raw": t["raw"],
                    "date": t.get("date"),
                    "time": t.get("time"),
                    "hour": t.get("hour"),
                    "minute": t.get("minute"),
                    "weekday": t.get("weekday"),
                    "daypart": t.get("daypart"),
                    "ambiguous": t.get("ambiguous", False),
                    "span": list(t["span"])
                },
                time_start_ms=time_start_ms,
                time_end_ms=time_end_ms
            )
        )

    # 3. Entity Claims
    entities, method = extract_entities(text)
    for ent in entities:
        claims.append(
            Claim(
                id=f"claim_ent_{uuid4().hex[:8]}",
                case_id=case_id,
                source_evidence_id=source_evidence_id,
                source_kind=source_kind,
                text=ent["text"],
                claim_type="entity",
                value={
                    "text": ent["text"],
                    "label": ent["label"],
                    "method": method,
                    "span": list(ent["span"])
                },
                time_start_ms=time_start_ms,
                time_end_ms=time_end_ms
            )
        )

    return claims
