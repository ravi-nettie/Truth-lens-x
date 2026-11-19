"""backend/app/routers/artifacts.py

API router for retrieving derived analysis artifacts.
"""

from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.db import get_db

router = APIRouter(tags=["Artifacts"])


@router.get("/artifacts/{artifact_id}")
def get_artifact(artifact_id: str):
    """Retrieves metadata or file content for a derived analysis artifact."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"Artifact '{artifact_id}' not found."}}
            )

        file_path_str = row["path"]
        if file_path_str:
            p = Path(file_path_str)
            if not p.is_absolute():
                p = (settings.data_path.parent / p).resolve()
            if p.exists() and p.is_file():
                return FileResponse(
                    path=str(p),
                    filename=p.name,
                    headers={"Content-Disposition": f'inline; filename="{p.name}"'}
                )

        return {
            "id": row["id"],
            "case_id": row["case_id"],
            "run_id": row["run_id"],
            "kind": row["kind"],
            "path": row["path"],
            "sha256": row["sha256"],
            "description": row["description"]
        }

