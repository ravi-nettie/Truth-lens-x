"""backend/app/routers/evidence.py

API router for evidence file streaming, hash verification, and deletion.
"""

from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.services.evidence_store import (
    BadRequestError,
    EvidenceStoreError,
    delete_evidence,
    verify_hash,
)

router = APIRouter(tags=["Evidence"])


@router.get("/evidence/{evidence_id}/file")
def get_evidence_file(evidence_id: str):
    """Streams original evidence file from read-only storage as attachment."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT stored_path, original_name, mime, deleted_at FROM evidence WHERE id = ?",
            (evidence_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"Evidence '{evidence_id}' not found."}}
            )

        if row["deleted_at"]:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"Evidence '{evidence_id}' has been deleted."}}
            )

        stored_path = Path(row["stored_path"])
        if not stored_path.is_absolute():
            stored_path = (settings.data_path.parent / stored_path).resolve()

        if not stored_path.exists():
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": "Evidence file not found on disk."}}
            )

        return FileResponse(
            path=str(stored_path),
            media_type=row["mime"],
            filename=row["original_name"],
            headers={"Content-Disposition": f'inline; filename="{row["original_name"]}"'}
        )


@router.post("/evidence/{evidence_id}/verify-hash")
def verify_evidence_hash(evidence_id: str) -> Dict[str, Any]:
    """Recomputes SHA-256 on disk, verifies against DB record, and logs audit entry."""
    try:
        return verify_hash(evidence_id)
    except EvidenceStoreError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": {"code": e.code, "message": e.message}}
        )


@router.delete("/evidence/{evidence_id}")
def delete_evidence_endpoint(
    evidence_id: str,
    confirm: bool = Query(default=False, description="Must be true to confirm permanent deletion")
) -> Dict[str, Any]:
    """
    Deletes evidence file and derived artifacts, sets tombstone deleted_at,
    and appends a hash-chained audit log entry.
    """
    try:
        return delete_evidence(evidence_id=evidence_id, confirm=confirm)
    except EvidenceStoreError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": {"code": e.code, "message": e.message}}
        )

