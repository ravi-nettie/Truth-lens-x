"""backend/app/routers/reports.py

API router for generating and streaming forensic reports.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Pure-Python local execution
- POST /api/cases/{id}/report: builds deterministic JSON + ReportLab PDF, transitions status to 'reported', logs audit
- GET /api/reports/{id}.pdf: streams PDF with application/pdf and Content-Disposition
- GET /api/reports/{id}.json: streams JSON with application/json and Content-Disposition
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.reporting.build_json import build_report_json
from backend.app.reporting.build_pdf import build_pdf_report
from backend.app.services.audit import append_audit
from shared.schemas import ReportGenerateRequest, ReportResponse

router = APIRouter(tags=["Reports"])


def _find_report_file(target_id: str, extension: str) -> Optional[Path]:
    """
    Finds a report file (.pdf or .json) by report_id or case_id.
    1. Looks directly for data/artifacts/*/reports/<target_id>.<ext>
    2. Looks in data/artifacts/<target_id>/reports/*.<ext> (taking latest modified)
    3. Searches recursively in settings.artifacts_dir for <target_id>.<ext>
    """
    clean_id = target_id.strip()

    # 1. Direct glob matching report filename
    for match in settings.artifacts_dir.glob(f"*/reports/{clean_id}.{extension}"):
        if match.is_file():
            return match

    # 2. Check if clean_id is a case_id directory containing reports
    case_reports_dir = settings.artifacts_dir / clean_id / "reports"
    if case_reports_dir.is_dir():
        files = list(case_reports_dir.glob(f"*.{extension}"))
        if files:
            files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            return files[0]

    # 3. Recursive fallback search
    for match in settings.artifacts_dir.glob(f"**/{clean_id}.{extension}"):
        if match.is_file():
            return match

    return None


@router.post("/cases/{case_id}/report", response_model=ReportResponse)
def generate_report(
    case_id: str,
    req: Optional[ReportGenerateRequest] = None
) -> ReportResponse:
    """
    Generates a deterministic JSON report and a clean ReportLab PDF directly from SQLite.
    Transitions case status to 'reported' and records audit trail.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, status FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        if not case_row:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"Case '{case_id}' not found."}}
            )

    report_id = f"rep_{uuid4().hex[:12]}"

    # 1. Build JSON report (includes evidence hash verification and audit logging)
    try:
        report_data = build_report_json(case_id=case_id, report_id=report_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "ANALYZER_FAILED", "message": f"Failed to build report JSON: {str(e)}"}}
        )

    # 2. Build ReportLab PDF report
    try:
        pdf_path = build_pdf_report(report_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "ANALYZER_FAILED", "message": f"Failed to build PDF report: {str(e)}"}}
        )

    # 3. Transition case status to 'reported' and log audit entry
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE cases SET status = 'reported' WHERE id = ?", (case_id,))

        append_audit(
            case_id=case_id,
            actor="analyst",
            action="GENERATE_REPORT",
            target=report_id,
            details={
                "report_id": report_id,
                "report_json_sha256": report_data["report_json_sha256"],
                "evidence_count": len(report_data.get("evidence_table", []))
            },
            conn=conn
        )

    fmt = req.format if (req and req.format in ("json", "pdf")) else "json"
    download_ext = "pdf" if fmt == "pdf" else "json"

    return ReportResponse(
        report_id=report_id,
        case_id=case_id,
        generated_at=report_data["report_meta"]["generated_at"],
        format=fmt,
        pdf_url=f"/api/reports/{report_id}.pdf",
        json_url=f"/api/reports/{report_id}.json",
        report_json_sha256=report_data["report_json_sha256"],
        report_json=report_data,
        download_url=f"/api/reports/{report_id}.{download_ext}"
    )


@router.get("/reports/{report_id}.pdf")
def get_pdf_report(report_id: str):
    """Streams the compiled PDF forensic report with proper MIME type and Content-Disposition."""
    pdf_file = _find_report_file(report_id, "pdf")
    if not pdf_file or not pdf_file.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"PDF report for '{report_id}' not found."}}
        )

    return FileResponse(
        path=str(pdf_file),
        media_type="application/pdf",
        filename=pdf_file.name,
        headers={"Content-Disposition": f'inline; filename="{pdf_file.name}"'}
    )


@router.get("/reports/{report_id}.json")
def get_json_report(report_id: str):
    """Streams the compiled JSON forensic report with proper MIME type and Content-Disposition."""
    json_file = _find_report_file(report_id, "json")
    if not json_file or not json_file.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"JSON report for '{report_id}' not found."}}
        )

    return FileResponse(
        path=str(json_file),
        media_type="application/json",
        filename=json_file.name,
        headers={"Content-Disposition": f'inline; filename="{json_file.name}"'}
    )
