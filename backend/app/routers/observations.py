"""backend/app/routers/observations.py

API router for observation review decisions.
Appends review decisions into the immutable review_decisions and audit_log tables.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from backend.app.db import get_db
from backend.app.services.audit import append_audit
from shared.schemas import ObservationReviewRequest, ReviewDecision, ReviewResponse, ReviewListResponse

router = APIRouter(tags=["Observations"])


@router.post("/observations/{observation_id}/review", response_model=ReviewResponse)
def review_observation(
    observation_id: str,
    req: ObservationReviewRequest
) -> ReviewResponse:
    """Records an analyst review verdict on a forensic observation."""
    now_ts = datetime.now(timezone.utc).isoformat()
    note_text = req.note or req.notes or ""
    if not note_text.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "BAD_REQUEST", "message": "Analyst justification note is required."}}
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT case_id FROM observations WHERE id = ?",
            (observation_id,)
        )
        row = cursor.fetchone()
        if not row:
            # Check if target is a claim, edge, or case
            cursor.execute("SELECT case_id FROM claims WHERE id = ?", (observation_id,))
            c_row = cursor.fetchone()
            if c_row:
                case_id = c_row["case_id"]
                target_type = "claim"
            else:
                cursor.execute("SELECT case_id FROM graph_edges WHERE id = ?", (observation_id,))
                e_row = cursor.fetchone()
                if e_row:
                    case_id = e_row["case_id"]
                    target_type = "edge"
                else:
                    cursor.execute("SELECT id FROM cases WHERE id = ?", (observation_id,))
                    case_row = cursor.fetchone()
                    if case_row:
                        case_id = case_row["id"]
                        target_type = "case"
                    else:
                        raise HTTPException(
                            status_code=404,
                            detail={"error": {"code": "NOT_FOUND", "message": f"Target entity '{observation_id}' not found."}}
                        )
        else:
            case_id = row["case_id"]
            target_type = "observation"

        review_id = f"rev_{uuid4().hex[:12]}"
        reviewer = req.reviewer or "analyst"

        cursor.execute(
            """
            INSERT INTO review_decisions
            (id, case_id, target_type, target_id, decision, note, reviewer, decided_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (review_id, case_id, target_type, observation_id, req.decision.value, note_text, reviewer, now_ts)
        )

        # Timeline event
        event_id = f"evt_{uuid4().hex[:12]}"
        cursor.execute(
            """
            INSERT INTO timeline_events (id, case_id, ts, media_time_ms, kind, ref_id, label)
            VALUES (?, ?, ?, NULL, 'review_decision', ?, ?)
            """,
            (event_id, case_id, now_ts, review_id, f"Review decision: {req.decision.value} on {target_type} {observation_id}")
        )

        # Update case status to 'in_review' if 'correlated'
        cursor.execute(
            "UPDATE cases SET status = 'in_review' WHERE id = ? AND status = 'correlated'",
            (case_id,)
        )

        append_audit(
            case_id=case_id,
            actor=reviewer,
            action="REVIEW_DECISION",
            target=observation_id,
            details={
                "review_id": review_id,
                "target_type": target_type,
                "decision": req.decision.value,
                "note": note_text,
                "reviewer": reviewer
            },
            conn=conn
        )

    return ReviewResponse(
        id=review_id,
        case_id=case_id,
        target_id=observation_id,
        target_type=target_type,
        decision=req.decision,
        notes=note_text,
        reviewer=reviewer,
        created_at=now_ts
    )


@router.get("/observations/{observation_id}/reviews", response_model=ReviewListResponse)
def get_observation_reviews(observation_id: str) -> ReviewListResponse:
    """Retrieves all historical review decisions for an observation, newest first."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM review_decisions WHERE target_id = ? ORDER BY decided_at DESC",
            (observation_id,)
        )
        rows = cursor.fetchall()

    items = [
        ReviewResponse(
            id=r["id"],
            case_id=r["case_id"],
            target_id=r["target_id"],
            target_type=r["target_type"],
            decision=ReviewDecision(r["decision"]),
            notes=r["note"],
            reviewer=r["reviewer"],
            created_at=r["decided_at"]
        )
        for r in rows
    ]
    return ReviewListResponse(reviews=items, total=len(items))


@router.get("/cases/{case_id}/reviews", response_model=ReviewListResponse)
def get_case_reviews(case_id: str) -> ReviewListResponse:
    """Retrieves all historical review decisions for a case, newest first."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM review_decisions WHERE case_id = ? ORDER BY decided_at DESC",
            (case_id,)
        )
        rows = cursor.fetchall()

    items = [
        ReviewResponse(
            id=r["id"],
            case_id=r["case_id"],
            target_id=r["target_id"],
            target_type=r["target_type"],
            decision=ReviewDecision(r["decision"]),
            notes=r["note"],
            reviewer=r["reviewer"],
            created_at=r["decided_at"]
        )
        for r in rows
    ]
    return ReviewListResponse(reviews=items, total=len(items))


