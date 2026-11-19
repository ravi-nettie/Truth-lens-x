"""backend/app/routers/health.py

API router for system health check.
"""

from typing import Any, Dict
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check() -> Dict[str, Any]:
    """Returns local service health and forensic operating parameters."""
    return {
        "status": "ok",
        "app": "TruthLens X",
        "offline": True,
        "cpu_only": True,
        "wal_mode": True
    }

