"""backend/app/routers/report.py

Alias router for backend/app/routers/reports.py.
Exports router, generate_report, get_pdf_report, and get_json_report.
"""

from backend.app.routers.reports import (
    router,
    generate_report,
    get_pdf_report,
    get_json_report,
)

__all__ = ["router", "generate_report", "get_pdf_report", "get_json_report"]

