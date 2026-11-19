"""backend/app/routers/cases.py

API router for case management, evidence upload, captions, analysis status,
graph, timeline, and audit log endpoints.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.services.audit import append_audit, verify_audit_chain
from backend.app.services.evidence_store import (
    EvidenceStoreError,
    ingest_evidence,
)
from backend.app.services.pipeline import run_case_pipeline
from shared.schemas import (
    AnalysisStatusResponse,
    CaptionCreateRequest,
    CaptionResponse,
    CaseCreateRequest,
    CaseDetailResponse,
    CaseListResponse,
    CaseResponse,
    Claim,
    EvidenceListResponse,
    EvidenceResponse,
    EvidenceUploadResponse,
    GraphEdge,
    GraphNode,
    GraphResponse,
    Modality,
    Observation,
    ReportGenerateRequest,
    ReportResponse,
    Strength,
    TimelineEvent,
    TimelineResponse,
)

router = APIRouter(tags=["Cases"])


@router.post("/cases", response_model=CaseResponse)
def create_case(req: CaseCreateRequest) -> CaseResponse:
    """Creates a new case with status 'created'."""
    case_id = f"case_{uuid4().hex[:12]}"
    now_ts = datetime.now(timezone.utc).isoformat()
    notes = req.notes or req.description or ""

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO cases (id, title, status, created_at, notes)
            VALUES (?, ?, 'created', ?, ?)
            """,
            (case_id, req.title, now_ts, notes)
        )
        append_audit(
            case_id=case_id,
            actor="analyst",
            action="CREATE_CASE",
            target=case_id,
            details={"title": req.title, "notes": notes},
            conn=conn
        )

    return CaseResponse(
        id=case_id,
        title=req.title,
        description=req.description or notes,
        created_at=now_ts,
        updated_at=now_ts,
        evidence_count=0,
        status="created"
    )


@router.get("/cases", response_model=CaseListResponse)
def list_cases() -> CaseListResponse:
    """Lists all cases with evidence counts and triage review priority."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.id, c.title, c.status, c.created_at, c.notes,
                   COUNT(DISTINCT e.id) as ev_count,
                   (SELECT details_json FROM audit_log WHERE case_id = c.id AND action = 'RUN_ANALYSIS' ORDER BY id DESC LIMIT 1) as analysis_audit
            FROM cases c
            LEFT JOIN evidence e ON c.id = e.case_id AND e.deleted_at IS NULL
            GROUP BY c.id
            ORDER BY c.created_at DESC
            """
        )
        rows = cursor.fetchall()

    case_items = []
    for r in rows:
        prio = "low"
        if r["analysis_audit"]:
            try:
                ad = json.loads(r["analysis_audit"])
                prio = ad.get("review_priority", "low")
            except Exception:
                pass

        case_items.append(
            CaseResponse(
                id=r["id"],
                title=r["title"],
                description=r["notes"] or "",
                created_at=r["created_at"],
                updated_at=r["created_at"],
                evidence_count=r["ev_count"],
                status=r["status"],
                review_priority=prio
            )
        )
    return CaseListResponse(cases=case_items, total=len(case_items))


@router.get("/cases/{case_id}", response_model=CaseDetailResponse)
def get_case(case_id: str) -> CaseDetailResponse:
    """Retrieves full details for a case, including its active evidence items."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        if not case_row:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}})

        # Evidence items
        cursor.execute(
            "SELECT * FROM evidence WHERE case_id = ? AND deleted_at IS NULL",
            (case_id,)
        )
        ev_rows = cursor.fetchall()

        # Counts
        cursor.execute("SELECT COUNT(*) as c FROM observations WHERE case_id = ?", (case_id,))
        obs_count = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) as c FROM claims WHERE case_id = ?", (case_id,))
        claim_count = cursor.fetchone()["c"]

        cursor.execute("SELECT COUNT(*) as c FROM graph_edges WHERE case_id = ? AND relation = 'CONTRADICTS'", (case_id,))
        contra_count = cursor.fetchone()["c"]

        cursor.execute(
            "SELECT details_json FROM audit_log WHERE case_id = ? AND action = 'RUN_ANALYSIS' ORDER BY id DESC LIMIT 1",
            (case_id,)
        )
        audit_row = cursor.fetchone()
        case_prio = "low"
        if audit_row and audit_row["details_json"]:
            try:
                ad = json.loads(audit_row["details_json"])
                case_prio = ad.get("review_priority", "low")
            except Exception:
                pass

    ev_list = [
        EvidenceResponse(
            id=r["id"],
            case_id=r["case_id"],
            filename=r["original_name"],
            original_name=r["original_name"],
            sha256=r["sha256"],
            modality=Modality(r["kind"]),
            kind=r["kind"],
            mime_type=r["mime"],
            mime=r["mime"],
            file_size_bytes=r["size_bytes"],
            size_bytes=r["size_bytes"],
            file_path=r["stored_path"],
            stored_path=r["stored_path"],
            created_at=r["uploaded_at"],
            uploaded_at=r["uploaded_at"],
            source_note=r["source_note"] or "",
            metadata={}
        )
        for r in ev_rows
    ]

    case_dto = CaseResponse(
        id=case_row["id"],
        title=case_row["title"],
        description=case_row["notes"] or "",
        created_at=case_row["created_at"],
        updated_at=case_row["created_at"],
        evidence_count=len(ev_list),
        status=case_row["status"],
        review_priority=case_prio
    )

    return CaseDetailResponse(
        case=case_dto,
        evidence_items=ev_list,
        observation_count=obs_count,
        claim_count=claim_count,
        contradiction_count=contra_count
    )


@router.post("/cases/{case_id}/evidence", response_model=EvidenceUploadResponse)
def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    source_note: Optional[str] = Form("")
) -> EvidenceUploadResponse:
    """
    Ingests and validates an evidence file into the read-only evidence repository.
    Enforces magic bytes, extension allow-list, size limits, and SHA-256 integrity.
    """
    try:
        res = ingest_evidence(
            case_id=case_id,
            original_filename=file.filename or "unknown",
            stream=file.file,
            source_note=source_note or ""
        )
    except EvidenceStoreError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": {"code": e.code, "message": e.message}}
        )

    ev_resp = EvidenceResponse(
        id=res["id"],
        case_id=res["case_id"],
        filename=res["filename"],
        original_name=res["original_name"],
        sha256=res["sha256"],
        modality=Modality(res["modality"]),
        kind=res["kind"],
        mime_type=res["mime_type"],
        mime=res["mime"],
        file_size_bytes=res["file_size_bytes"],
        size_bytes=res["size_bytes"],
        file_path=res["file_path"],
        stored_path=res["stored_path"],
        created_at=res["created_at"],
        uploaded_at=res["uploaded_at"],
        source_note=res.get("source_note", ""),
        metadata={}
    )
    return EvidenceUploadResponse(
        evidence=ev_resp,
        message="Evidence ingested and stored in read-only repository."
    )


@router.post("/cases/{case_id}/caption", response_model=CaptionResponse)
def add_caption(
    case_id: str,
    req: CaptionCreateRequest
) -> CaptionResponse:
    """Ingests a text caption or accompanying social media post as text evidence and claim."""
    now_ts = datetime.now(timezone.utc).isoformat()
    clean_text = req.text.strip()
    source = req.source or "social_post"

    # Verify case exists
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cases WHERE id = ?", (case_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}})

    # Write as text file in read-only evidence store
    import io
    txt_stream = io.BytesIO(clean_text.encode("utf-8"))
    filename = f"caption_{uuid4().hex[:8]}.txt"

    res = ingest_evidence(
        case_id=case_id,
        original_filename=filename,
        stream=txt_stream,
        source_note=f"Caption from {source}"
    )

    caption_id = res["id"]

    # Also store claim entry
    claim_id = f"claim_{uuid4().hex[:12]}"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO claims (id, case_id, source_evidence_id, source_kind, text, claim_type, value_json, time_start_ms, time_end_ms)
            VALUES (?, ?, ?, 'caption', ?, 'statement', ?, NULL, NULL)
            """,
            (claim_id, case_id, caption_id, clean_text, json.dumps({"source": source, "text": clean_text}))
        )
        append_audit(
            case_id=case_id,
            actor="analyst",
            action="INGEST_CAPTION",
            target=caption_id,
            details={"caption_id": caption_id, "text": clean_text, "source": source},
            conn=conn
        )

    return CaptionResponse(
        id=caption_id,
        case_id=case_id,
        text=clean_text,
        source=source,
        created_at=now_ts
    )


@router.post("/cases/{case_id}/analyze")
def trigger_analysis(
    case_id: str,
    background_tasks: BackgroundTasks,
    sync: bool = Query(default=False, description="Whether to execute synchronously")
) -> Dict[str, Any]:
    """
    Triggers the multimodal forensic pipeline for all evidence items in the case.
    Executes in background or synchronously based on the ?sync parameter.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cases WHERE id = ?", (case_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}})

    if sync:
        result = run_case_pipeline(case_id)
        return {
            "message": "Analysis completed synchronously.",
            "evidence_processed": result.get("evidence_count", 0),
            **result
        }
    else:
        background_tasks.add_task(run_case_pipeline, case_id)
        return {
            "message": "Analysis started in background.",
            "case_id": case_id,
            "status": "analyzing"
        }


@router.get("/cases/{case_id}/status", response_model=AnalysisStatusResponse)
def get_case_status(case_id: str) -> AnalysisStatusResponse:
    """Returns the current pipeline execution status for a case."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, status FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        if not case_row:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}})

        cursor.execute(
            "SELECT status, error FROM analysis_runs WHERE evidence_id IN "
            "(SELECT id FROM evidence WHERE case_id = ?)",
            (case_id,)
        )
        runs = cursor.fetchall()

    errors = [r["error"] for r in runs if r["error"]]
    st = case_row["status"]

    progress = 0.0
    if st == "created":
        progress = 0.0
    elif st == "ingested":
        progress = 20.0
    elif st == "analyzing":
        progress = 50.0
    elif st in ("analyzed", "correlated", "in_review", "reported"):
        progress = 100.0

    return AnalysisStatusResponse(
        case_id=case_id,
        status="completed" if st in ("correlated", "in_review", "reported") else ("running" if st == "analyzing" else "idle"),
        progress_percent=progress,
        current_step=f"Case status: {st}",
        errors=errors
    )


@router.get("/cases/{case_id}/observations", response_model=List[Observation])
def get_observations(
    case_id: str,
    modality: Optional[str] = Query(default=None, description="Optional modality filter (image, video, audio, text)")
) -> List[Observation]:
    """Retrieves forensic observations for a case, with optional modality filter."""
    with get_db() as conn:
        cursor = conn.cursor()
        if modality:
            cursor.execute(
                "SELECT * FROM observations WHERE case_id = ? AND modality = ? ORDER BY id ASC",
                (case_id, modality)
            )
        else:
            cursor.execute(
                "SELECT * FROM observations WHERE case_id = ? ORDER BY id ASC",
                (case_id,)
            )
        rows = cursor.fetchall()

    observations: List[Observation] = []
    for r in rows:
        region = json.loads(r["region_json"]) if r["region_json"] else None
        artifact_ids = json.loads(r["artifact_ids_json"]) if r["artifact_ids_json"] else []
        details = json.loads(r["details_json"]) if r["details_json"] else {}
        observations.append(
            Observation(
                id=r["id"],
                case_id=r["case_id"],
                evidence_id=r["evidence_id"],
                modality=Modality(r["modality"]),
                indicator=r["indicator"],
                method=r["method"],
                summary=r["summary"],
                explanation=r["explanation"],
                alternative_explanation=r["alternative_explanation"] or "",
                evidence_strength=Strength(r["evidence_strength"]),
                model_score=r["model_score"],
                model_calibrated=bool(r["model_calibrated"]),
                model_name=r["model_name"],
                region=region,
                time_start_ms=r["time_start_ms"],
                time_end_ms=r["time_end_ms"],
                artifact_ids=artifact_ids,
                details=details,
                limitations=r["limitations"] or ""
            )
        )
    return observations


@router.get("/cases/{case_id}/claims", response_model=List[Claim])
def get_case_claims(case_id: str) -> List[Claim]:
    """Returns all extracted claims for a case."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM claims WHERE case_id = ? ORDER BY id ASC",
            (case_id,)
        )
        rows = cursor.fetchall()

    claims: List[Claim] = []
    for r in rows:
        val = json.loads(r["value_json"]) if r["value_json"] else {}
        claims.append(
            Claim(
                id=r["id"],
                case_id=r["case_id"],
                source_evidence_id=r["source_evidence_id"],
                source_kind=r["source_kind"],
                text=r["text"],
                claim_type=r["claim_type"],
                value=val,
                time_start_ms=r["time_start_ms"],
                time_end_ms=r["time_end_ms"]
            )
        )
    return claims



@router.get("/cases/{case_id}/graph", response_model=GraphResponse)
def get_graph(case_id: str) -> GraphResponse:
    """Returns the correlation graph nodes and edges for a case."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Fetch edges
        cursor.execute("SELECT * FROM graph_edges WHERE case_id = ?", (case_id,))
        edge_rows = cursor.fetchall()

        # Fetch evidence as nodes
        cursor.execute("SELECT id, original_name, kind, sha256, mime, size_bytes FROM evidence WHERE case_id = ? AND deleted_at IS NULL", (case_id,))
        ev_rows = cursor.fetchall()

        # Fetch observations as nodes
        cursor.execute("SELECT id, summary, modality, evidence_strength, details_json FROM observations WHERE case_id = ?", (case_id,))
        obs_rows = cursor.fetchall()

        # Fetch claims as nodes
        cursor.execute("SELECT id, text, claim_type, value_json FROM claims WHERE case_id = ?", (case_id,))
        claim_rows = cursor.fetchall()

    nodes: List[GraphNode] = []
    for ev in ev_rows:
        kind_str = ev["kind"]
        modality = Modality(kind_str) if kind_str in ("image", "video", "audio", "text") else None
        nodes.append(
            GraphNode(
                id=ev["id"],
                label=ev["original_name"] or ev["id"],
                kind="evidence",
                modality=modality,
                strength=None,
                details={"sha256": ev["sha256"], "mime": ev["mime"], "size_bytes": ev["size_bytes"]}
            )
        )

    for o in obs_rows:
        nodes.append(
            GraphNode(
                id=o["id"],
                label=o["summary"],
                kind="observation",
                modality=Modality(o["modality"]),
                strength=Strength(o["evidence_strength"]),
                details=json.loads(o["details_json"] or "{}")
            )
        )

    for c in claim_rows:
        nodes.append(
            GraphNode(
                id=c["id"],
                label=c["text"][:60],
                kind="claim",
                modality=Modality.text,
                strength=None,
                details=json.loads(c["value_json"] or "{}")
            )
        )

    edges: List[GraphEdge] = []
    for e in edge_rows:
        ev_obs_ids = json.loads(e["evidence_observation_ids_json"] or "[]")
        edges.append(
            GraphEdge(
                id=e["id"],
                case_id=e["case_id"],
                src_id=e["src_id"],
                dst_id=e["dst_id"],
                relation=e["relation"],
                rule=e["rule"],
                evidence_observation_ids=ev_obs_ids,
                explanation=e["explanation"],
                alternative_explanation=e["alternative_explanation"] or "",
                strength=Strength(e["strength"])
            )
        )

    return GraphResponse(case_id=case_id, nodes=nodes, edges=edges)


@router.get("/cases/{case_id}/timeline", response_model=TimelineResponse)
def get_timeline(case_id: str) -> TimelineResponse:
    """Returns chronological provenance and media timeline events for a case."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM timeline_events WHERE case_id = ? ORDER BY ts ASC, media_time_ms ASC",
            (case_id,)
        )
        rows = cursor.fetchall()

    events = [
        TimelineEvent(
            id=r["id"],
            case_id=r["case_id"],
            ts=r["ts"],
            media_time_ms=r["media_time_ms"],
            kind=r["kind"],
            ref_id=r["ref_id"],
            label=r["label"]
        )
        for r in rows
    ]
    return TimelineResponse(case_id=case_id, events=events)


@router.get("/cases/{case_id}/audit")
def get_audit(case_id: str) -> Dict[str, Any]:
    """Returns the case audit log records and cryptographic chain verification result."""
    verification = verify_audit_chain(case_id)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, case_id, ts, actor, action, target, details_json, prev_hash, entry_hash "
            "FROM audit_log WHERE case_id = ? ORDER BY id ASC",
            (case_id,)
        )
        rows = [dict(r) for r in cursor.fetchall()]

    for r in rows:
        if r.get("details_json"):
            try:
                r["details"] = json.loads(r["details_json"])
            except Exception:
                r["details"] = r["details_json"]

    return {
        "case_id": case_id,
        "verification": verification,
        "entries": rows
    }


@router.post("/cases/{case_id}/report", response_model=ReportResponse)
def create_report(case_id: str, req: Optional[ReportGenerateRequest] = None) -> ReportResponse:
    """Generates deterministic JSON and PDF reports for the given case."""
    from backend.app.routers.reports import generate_report as run_generate_report
    return run_generate_report(case_id=case_id, req=req)


@router.delete("/cases/{case_id}")
def delete_case(case_id: str) -> Dict[str, Any]:
    """Deletes a case and cleans up associated records."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cases WHERE id = ?", (case_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}}
            )

        cursor.execute("DELETE FROM review_decisions WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM timeline_events WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM graph_edges WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM claims WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM observations WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM analysis_runs WHERE evidence_id IN (SELECT id FROM evidence WHERE case_id = ?)", (case_id,))
        cursor.execute("DELETE FROM artifacts WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM evidence WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM audit_log WHERE case_id = ?", (case_id,))
        cursor.execute("DELETE FROM cases WHERE id = ?", (case_id,))

    return {"deleted": True, "case_id": case_id}


