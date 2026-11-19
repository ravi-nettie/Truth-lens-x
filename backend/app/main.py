"""backend/app/main.py

FastAPI Application entrypoint for TruthLens X.
Adheres to Rule 1, 2, 3, and 4:
- Local-first & offline execution
- Standardized ErrorResponse envelope
- Mounts all 15 core forensic endpoints under /api
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.db import init_db
from backend.app.routers.artifacts import router as artifacts_router
from backend.app.routers.cases import router as cases_router
from backend.app.routers.evidence import router as evidence_router
from backend.app.routers.health import router as health_router
from backend.app.routers.observations import router as observations_router
from backend.app.routers.reports import router as reports_router
from shared.schemas import ErrorCode, ErrorDetail, ErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure directories and database tables exist
    settings.ensure_dirs()
    init_db()
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title="TruthLens X",
    description="Offline CPU-First Multimodal Forensic Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Local development CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers returning standard ErrorResponse envelope
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Formats HTTP exceptions into the standard ErrorResponse contract."""
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    # Map status code to standard ErrorCode
    code_map = {
        400: ErrorCode.BAD_REQUEST,
        404: ErrorCode.NOT_FOUND,
        413: ErrorCode.TOO_LARGE,
        415: ErrorCode.UNSUPPORTED_TYPE,
        422: ErrorCode.CORRUPT_FILE,
        501: ErrorCode.ANALYZER_FAILED,
        503: ErrorCode.MODEL_MISSING,
    }
    code = code_map.get(exc.status_code, ErrorCode.ANALYZER_FAILED)

    envelope = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=str(exc.detail),
            detail=None
        )
    )
    return JSONResponse(status_code=exc.status_code, content=envelope.model_dump())


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats Pydantic/FastAPI validation errors into standard ErrorResponse."""
    envelope = ErrorResponse(
        error=ErrorDetail(
            code=ErrorCode.CORRUPT_FILE,
            message="Request validation error.",
            detail=exc.errors()
        )
    )
    return JSONResponse(status_code=422, content=envelope.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catches unhandled exceptions and wraps them in ANALYZER_FAILED ErrorResponse."""
    envelope = ErrorResponse(
        error=ErrorDetail(
            code=ErrorCode.ANALYZER_FAILED,
        message=f"Internal system error: {exc}",
            detail=None
        )
    )
    return JSONResponse(status_code=500, content=envelope.model_dump())


# Mount routers under /api and /api/v1
for prefix in ("/api", "/api/v1"):
    app.include_router(health_router, prefix=prefix)
    app.include_router(cases_router, prefix=prefix)
    app.include_router(evidence_router, prefix=prefix)
    app.include_router(observations_router, prefix=prefix)
    app.include_router(artifacts_router, prefix=prefix)
    app.include_router(reports_router, prefix=prefix)

# Also expose /health at root
app.include_router(health_router)

# Mount frontend/dist for Single-Port Production Serving
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if frontend_dist.is_dir() and (frontend_dist / "index.html").is_file():
    assets_dir = frontend_dist / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serves static assets or falls back to index.html for client-side SPA routing."""
        # Non-matched API paths must return 404 ErrorResponse, not the HTML SPA
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(
                status_code=404,
                detail={"error": {"code": "NOT_FOUND", "message": f"API endpoint '/{full_path}' not found."}}
            )

        # Serve static file if it directly exists in frontend_dist (e.g. favicon, mockServiceWorker)
        target_file = frontend_dist / full_path
        if full_path and target_file.is_file():
            return FileResponse(target_file)

        # Client-side SPA routing fallback
        return FileResponse(frontend_dist / "index.html")


