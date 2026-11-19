"""backend/app/reporting/templates.py

ReportLab Styles and PDF Canvas Templates for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Pure-Python ReportLab rendering (no browser / WeasyPrint dependencies)
- Escapes all user-supplied text with xml.sax.saxutils.escape
- NumberedCanvas pattern for page numbers and running disclaimers
- Standardized styling for all 11 required sections
"""

from typing import Any, List, Optional
import xml.sax.saxutils

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


def safe_text(val: Any) -> str:
    """Escapes user and database text for safe inclusion in ReportLab XML paragraphs."""
    if val is None:
        return ""
    if isinstance(val, (dict, list)):
        import json
        s = json.dumps(val, ensure_ascii=False)
    else:
        s = str(val)
    return xml.sax.saxutils.escape(s)


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that accumulates total page count and stamps running
    headers, footers, page numbers, and disclaimers on every page.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[Any] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Top Header
        self.drawString(36, 762, "TruthLens X Forensic Report — Offline Multimodal Analysis Engine")
        self.drawRightString(576, 762, "CONFIDENTIAL / DECISION-SUPPORT ONLY")

        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 756, 576, 756)

        # Running Bottom Footer
        self.line(36, 38, 576, 38)
        self.setFont("Helvetica", 7.5)
        self.drawString(36, 26, "DECISION-SUPPORT ONLY — NOT A FORENSIC VERDICT OR PROOF OF AUTHENTICITY")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 26, page_str)

        self.restoreState()


def get_report_styles():
    """Generates custom typography styles for the forensic report."""
    base = getSampleStyleSheet()

    styles = {
        "DocTitle": ParagraphStyle(
            "DocTitle",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        ),
        "DocSub": ParagraphStyle(
            "DocSub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#475569"),
            spaceAfter=10,
        ),
        "BannerHeading": ParagraphStyle(
            "BannerHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#991b1b"),
            alignment=1,  # Center
            spaceAfter=4,
        ),
        "BannerBody": ParagraphStyle(
            "BannerBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#7f1d1d"),
            alignment=1,  # Center
        ),
        "SectionHeading": ParagraphStyle(
            "SectionHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=12,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "SubSectionHeading": ParagraphStyle(
            "SubSectionHeading",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12.5,
            textColor=colors.HexColor("#1e293b"),
            spaceBefore=8,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=4,
        ),
        "BodyBold": ParagraphStyle(
            "BodyBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#0f172a"),
        ),
        "TableHead": ParagraphStyle(
            "TableHead",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.white,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#1e293b"),
        ),
        "TableCellBold": ParagraphStyle(
            "TableCellBold",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#0f172a"),
        ),
        "TableCellCode": ParagraphStyle(
            "TableCellCode",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=6.5,
            leading=8.5,
            textColor=colors.HexColor("#0f172a"),
        ),
        "FooterHash": ParagraphStyle(
            "FooterHash",
            parent=base["Normal"],
            fontName="Courier-Bold",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#0f172a"),
            alignment=1,
        ),
        "CalloutText": ParagraphStyle(
            "CalloutText",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#334155"),
        ),
    }

    return styles

