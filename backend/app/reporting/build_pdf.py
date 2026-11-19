"""backend/app/reporting/build_pdf.py

Forensic Report PDF Generator for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Pure-Python ReportLab rendering (SimpleDocTemplate, Paragraph, Table, Spacer, PageBreak)
- Zero external browser or WeasyPrint dependency
- Escapes all user-supplied text with xml.sax.saxutils.escape
- Renders all 11 required forensic sections in exact order:
  1. Cover & Summary Banner
  2. Evidence Table
  3. Media Metadata
  4. Methods Used
  5. Findings Table (Sorted by Strength)
  6. Cross-Modal Relationships
  7. Provenance & Tamper Timeline
  8. Limitations & Alternative Explanations
  9. Recommendations for Human Review
  10. Analysis History & Audit Log Excerpt
  11. Report Integrity Footer
- Saves PDF to data/artifacts/<case_id>/reports/<report_id>.pdf
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from backend.app.config import settings
from backend.app.reporting.templates import (
    NumberedCanvas,
    get_report_styles,
    safe_text,
)


def _make_table_style(has_header: bool = True, num_rows: int = 1) -> TableStyle:
    """Standard clean table style with alternating row colors."""
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if has_header:
        cmds.extend([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ])
        start_row = 1
    else:
        start_row = 0

    for i in range(start_row, num_rows):
        bg = colors.HexColor("#f8fafc") if (i % 2 == 1) else colors.white
        cmds.append(("BACKGROUND", (0, i), (-1, i), bg))

    return TableStyle(cmds)


def build_pdf_report(report_data: Dict[str, Any], output_path: Optional[Path] = None) -> Path:
    """
    Renders the deterministic forensic report PDF strictly from the compiled report dictionary.
    Guarantees all 11 required sections in exact order.
    """
    report_meta = report_data.get("report_meta", {})
    case_summary = report_data.get("case_summary", {})
    case_id = report_meta.get("case_id", "unknown_case")
    report_id = report_meta.get("report_id", "rep_unknown")

    if output_path is None:
        reports_dir = settings.artifacts_dir / case_id / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        output_path = reports_dir / f"{report_id}.pdf"
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)

    # 540 pt printable width (letter is 612x792, 36pt margins left & right)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=45,
        bottomMargin=45,
    )

    styles = get_report_styles()
    story: List[Any] = []

    # =========================================================================
    # SECTION 1: Cover & Summary Banner
    # =========================================================================
    story.append(Paragraph("1. Cover & Summary Banner: TruthLens X Forensic Report", styles["DocTitle"]))
    story.append(
        Paragraph(
            f"Case: <b>{safe_text(report_meta.get('case_title'))}</b> (ID: {safe_text(case_id)}) &nbsp;|&nbsp; "
            f"Generated: {safe_text(report_meta.get('generated_at'))} &nbsp;|&nbsp; "
            f"Engine Version: TruthLens X {safe_text(report_meta.get('tool_version', '1.0.0'))}",
            styles["DocSub"],
        )
    )

    # Prominent Warning Banner Box
    prio = str(case_summary.get("review_priority", "low")).upper()
    unreviewed_cnt = case_summary.get("unreviewed_count", 0)
    total_findings = case_summary.get("total_findings", 0)
    str_counts = case_summary.get("strength_counts", {})
    rev_counts = case_summary.get("review_status_counts", {})

    banner_data = [
        [
            Paragraph(
                "DECISION-SUPPORT ONLY — NOT A VERDICT",
                styles["BannerHeading"],
            )
        ],
        [
            Paragraph(
                f"<b>Disclaimer:</b> {safe_text(report_meta.get('disclaimer'))}<br/>"
                f"<b>Custody Note:</b> {safe_text(report_meta.get('custody_note'))}",
                styles["BannerBody"],
            )
        ],
        [
            Paragraph(
                f"<b>Review Priority Triage:</b> <font color='#991b1b'><b>{safe_text(prio)}</b></font> "
                f"({safe_text(case_summary.get('review_priority_label'))})<br/>"
                f"<b>Priority Formula:</b> <i>{safe_text(case_summary.get('review_priority_formula'))}</i><br/>"
                f"<b>Findings Triage:</b> <b>{unreviewed_cnt} Unreviewed Findings</b> "
                f"(Total: {total_findings} | Strong: {str_counts.get('strong', 0)}, "
                f"Moderate: {str_counts.get('moderate', 0)}, Weak: {str_counts.get('weak', 0)}, "
                f"Informational: {str_counts.get('informational', 0)}) &nbsp;|&nbsp; "
                f"Confirmed: {rev_counts.get('confirmed', 0)}, Dismissed: {rev_counts.get('dismissed', 0)}, "
                f"Needs Work: {rev_counts.get('needs_more_work', 0)}",
                styles["BannerBody"],
            )
        ],
    ]
    banner_table = Table(banner_data, colWidths=[540])
    banner_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#dc2626")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#fca5a5")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(banner_table)
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECTION 2: Evidence Table
    # =========================================================================
    story.append(Paragraph("2. Evidence Table & Pre-Report Hash Verification", styles["SectionHeading"]))
    evidence_items = report_data.get("evidence_table", [])
    if not evidence_items:
        story.append(Paragraph("<i>No active evidence files registered for this case.</i>", styles["Body"]))
    else:
        ev_rows = [[
            Paragraph("Original Name", styles["TableHead"]),
            Paragraph("Kind", styles["TableHead"]),
            Paragraph("Size", styles["TableHead"]),
            Paragraph("SHA-256 Hash", styles["TableHead"]),
            Paragraph("Uploaded At", styles["TableHead"]),
            Paragraph("Pre-Check", styles["TableHead"]),
        ]]
        for ev in evidence_items:
            status = ev.get("verification_status", "UNKNOWN")
            status_color = "#15803d" if status == "PASS" else "#b91c1c"
            ev_rows.append([
                Paragraph(safe_text(ev.get("original_name")), styles["TableCellBold"]),
                Paragraph(safe_text(ev.get("kind")), styles["TableCell"]),
                Paragraph(safe_text(ev.get("size_human")), styles["TableCell"]),
                Paragraph(safe_text(ev.get("sha256")), styles["TableCellCode"]),
                Paragraph(safe_text(ev.get("uploaded_at")), styles["TableCell"]),
                Paragraph(f"<font color='{status_color}'><b>{safe_text(status)}</b></font>", styles["TableCell"]),
            ])
        ev_table = Table(ev_rows, colWidths=[110, 45, 50, 185, 100, 50])
        ev_table.setStyle(_make_table_style(has_header=True, num_rows=len(ev_rows)))
        story.append(ev_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 3: Media Metadata
    # =========================================================================
    story.append(Paragraph("3. Media Metadata (Key EXIF / ffprobe Fields with Source Attribution)", styles["SectionHeading"]))
    media_metadata = report_data.get("media_metadata", [])
    if not media_metadata:
        story.append(Paragraph("<i>No media metadata extracted.</i>", styles["Body"]))
    else:
        for mm in media_metadata:
            ev_title = f"{mm.get('filename')} ({mm.get('kind', 'media')})"
            attrib = mm.get("source_attribution") or "Extracted from media file container"
            story.append(Paragraph(f"<b>{safe_text(ev_title)}</b> — <i>{safe_text(attrib)}</i>", styles["SubSectionHeading"]))

            attrs = mm.get("attributes", {})
            if not attrs:
                story.append(Paragraph("<i>No EXIF or container tags detected.</i>", styles["Body"]))
            else:
                meta_rows = []
                for k, v in attrs.items():
                    meta_rows.append([
                        Paragraph(f"<b>{safe_text(k)}</b>", styles["TableCellBold"]),
                        Paragraph(safe_text(v), styles["TableCell"]),
                    ])
                m_table = Table(meta_rows, colWidths=[160, 380])
                m_table.setStyle(_make_table_style(has_header=False, num_rows=len(meta_rows)))
                story.append(m_table)
            story.append(Spacer(1, 4))
    story.append(Spacer(1, 8))

    # =========================================================================
    # SECTION 4: Methods Used
    # =========================================================================
    story.append(Paragraph("4. Methods Used & Analysis Runs", styles["SectionHeading"]))
    methods = report_data.get("methods_used", [])
    if not methods:
        story.append(Paragraph("<i>No analysis runs recorded.</i>", styles["Body"]))
    else:
        m_rows = [[
            Paragraph("Analyzer", styles["TableHead"]),
            Paragraph("Version", styles["TableHead"]),
            Paragraph("Target Evidence", styles["TableHead"]),
            Paragraph("Status & Skipped/Failed Reason", styles["TableHead"]),
            Paragraph("Completed At", styles["TableHead"]),
        ]]
        for m in methods:
            st = m.get("status", "")
            err = m.get("error") or ""
            status_text = f"<b>{safe_text(st)}</b>"
            if err:
                status_text += f"<br/><font color='#b91c1c'>{safe_text(err)}</font>"
            m_rows.append([
                Paragraph(safe_text(m.get("analyzer")), styles["TableCellBold"]),
                Paragraph(safe_text(m.get("tool_version")), styles["TableCell"]),
                Paragraph(safe_text(m.get("evidence_id")), styles["TableCellCode"]),
                Paragraph(status_text, styles["TableCell"]),
                Paragraph(safe_text(m.get("finished_at") or m.get("started_at")), styles["TableCell"]),
            ])
        methods_table = Table(m_rows, colWidths=[100, 45, 95, 160, 140])
        methods_table.setStyle(_make_table_style(has_header=True, num_rows=len(m_rows)))
        story.append(methods_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 5: Findings Table (Sorted by Strength)
    # =========================================================================
    story.append(Paragraph("5. Findings Table (Sorted by Strength: Strong &rarr; Informational)", styles["SectionHeading"]))
    findings = report_data.get("findings", [])
    if not findings:
        story.append(Paragraph("<i>No forensic observations recorded.</i>", styles["Body"]))
    else:
        f_rows = [[
            Paragraph("Strength", styles["TableHead"]),
            Paragraph("Indicator", styles["TableHead"]),
            Paragraph("Summary & Explanation", styles["TableHead"]),
            Paragraph("Region / Time", styles["TableHead"]),
            Paragraph("Model Score", styles["TableHead"]),
            Paragraph("Human Review Status & Note", styles["TableHead"]),
        ]]
        strength_colors = {
            "strong": "#b91c1c",
            "moderate": "#d97706",
            "weak": "#4b5563",
            "informational": "#2563eb",
        }
        for f in findings:
            st_val = str(f.get("evidence_strength", "")).lower()
            color_hex = strength_colors.get(st_val, "#1e293b")

            summary_text = f"<b>{safe_text(f.get('summary'))}</b><br/>{safe_text(f.get('explanation'))}"
            if f.get("alternative_explanation"):
                summary_text += f"<br/><i>Alt: {safe_text(f.get('alternative_explanation'))}</i>"

            score_str = safe_text(f.get("model_score_display") or "N/A")

            rev_st = f.get("human_review_status", "unreviewed")
            rev_note = f.get("latest_reviewer_note") or ""
            rev_text = f"<b>{safe_text(rev_st.upper())}</b>"
            if rev_note:
                rev_text += f"<br/><i>Note: {safe_text(rev_note)}</i>"

            f_rows.append([
                Paragraph(f"<font color='{color_hex}'><b>{safe_text(st_val.upper())}</b></font>", styles["TableCell"]),
                Paragraph(f"<b>{safe_text(f.get('indicator'))}</b><br/>{safe_text(f.get('modality'))}", styles["TableCell"]),
                Paragraph(summary_text, styles["TableCell"]),
                Paragraph(safe_text(f.get("region_or_timestamp")), styles["TableCellCode"]),
                Paragraph(score_str, styles["TableCell"]),
                Paragraph(rev_text, styles["TableCell"]),
            ])
        findings_table = Table(f_rows, colWidths=[55, 85, 160, 70, 70, 100])
        findings_table.setStyle(_make_table_style(has_header=True, num_rows=len(f_rows)))
        story.append(findings_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 6: Cross-Modal Relationships
    # =========================================================================
    story.append(Paragraph("6. Cross-Modal Relationships", styles["SectionHeading"]))
    edges = report_data.get("cross_modal_relationships", [])
    if not edges:
        story.append(Paragraph("<i>No cross-modal relationship edges generated.</i>", styles["Body"]))
    else:
        e_rows = [[
            Paragraph("Relation", styles["TableHead"]),
            Paragraph("Rule", styles["TableHead"]),
            Paragraph("Cited Obs IDs", styles["TableHead"]),
            Paragraph("Explanation", styles["TableHead"]),
            Paragraph("Alternative Explanation", styles["TableHead"]),
        ]]
        for edge in edges:
            rel = edge.get("relation", "")
            rel_color = "#b91c1c" if rel == "CONTRADICTS" else "#15803d"
            obs_str = ", ".join(edge.get("evidence_observation_ids", []))
            e_rows.append([
                Paragraph(f"<font color='{rel_color}'><b>{safe_text(rel)}</b></font>", styles["TableCell"]),
                Paragraph(safe_text(edge.get("rule")), styles["TableCellBold"]),
                Paragraph(safe_text(obs_str), styles["TableCellCode"]),
                Paragraph(safe_text(edge.get("explanation")), styles["TableCell"]),
                Paragraph(safe_text(edge.get("alternative_explanation")), styles["TableCell"]),
            ])
        edge_table = Table(e_rows, colWidths=[65, 85, 70, 160, 160])
        edge_table.setStyle(_make_table_style(has_header=True, num_rows=len(e_rows)))
        story.append(edge_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 7: Provenance & Tamper Timeline
    # =========================================================================
    story.append(Paragraph("7. Provenance & Tamper Timeline", styles["SectionHeading"]))
    timeline = report_data.get("timeline", [])
    if not timeline:
        story.append(Paragraph("<i>No timeline events logged.</i>", styles["Body"]))
    else:
        tl_rows = [[
            Paragraph("Timestamp / Media Time", styles["TableHead"]),
            Paragraph("Kind", styles["TableHead"]),
            Paragraph("Reference ID", styles["TableHead"]),
            Paragraph("Event Summary / Label", styles["TableHead"]),
        ]]
        for te in timeline:
            time_label = te.get("ts") or ""
            if te.get("media_time_ms") is not None:
                time_label += f" ({te['media_time_ms']}ms)"
            tl_rows.append([
                Paragraph(safe_text(time_label), styles["TableCell"]),
                Paragraph(safe_text(te.get("kind")), styles["TableCellBold"]),
                Paragraph(safe_text(te.get("ref_id")), styles["TableCellCode"]),
                Paragraph(safe_text(te.get("label")), styles["TableCell"]),
            ])
        tl_table = Table(tl_rows, colWidths=[110, 85, 105, 240])
        tl_table.setStyle(_make_table_style(has_header=True, num_rows=len(tl_rows)))
        story.append(tl_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 8: Limitations & Alternative Explanations
    # =========================================================================
    story.append(Paragraph("8. Limitations & Alternative Explanations", styles["SectionHeading"]))
    lim_data = report_data.get("limitations_and_alternatives", {})
    risks = lim_data.get("per_modality_risks", {})
    uncertainties = lim_data.get("uncertainty_categories", {})

    story.append(Paragraph("<b>Per-Modality False-Positive Risks:</b>", styles["SubSectionHeading"]))
    risk_rows = []
    for mod, desc in risks.items():
        risk_rows.append([
            Paragraph(f"<b>{safe_text(mod.upper())}</b>", styles["TableCellBold"]),
            Paragraph(safe_text(desc), styles["TableCell"]),
        ])
    if risk_rows:
        r_table = Table(risk_rows, colWidths=[90, 450])
        r_table.setStyle(_make_table_style(has_header=False, num_rows=len(risk_rows)))
        story.append(r_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>Structured Uncertainty Categories:</b>", styles["SubSectionHeading"]))
    unc_rows = []
    for cat, desc in uncertainties.items():
        unc_rows.append([
            Paragraph(f"<b>{safe_text(cat.upper())}</b>", styles["TableCellBold"]),
            Paragraph(safe_text(desc), styles["TableCell"]),
        ])
    if unc_rows:
        u_table = Table(unc_rows, colWidths=[90, 450])
        u_table.setStyle(_make_table_style(has_header=False, num_rows=len(unc_rows)))
        story.append(u_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 9: Recommendations for Human Review
    # =========================================================================
    story.append(Paragraph("9. Recommendations for Human Review", styles["SectionHeading"]))
    recs = report_data.get("human_review_recommendations", [])
    if not recs:
        story.append(Paragraph("<i>No specific verification actions flagged.</i>", styles["Body"]))
    else:
        rec_rows = []
        for idx, rec in enumerate(recs, 1):
            rec_rows.append([
                Paragraph(f"<b>Step {idx}</b>", styles["TableCellBold"]),
                Paragraph(safe_text(rec), styles["TableCell"]),
            ])
        rec_table = Table(rec_rows, colWidths=[55, 485])
        rec_table.setStyle(_make_table_style(has_header=False, num_rows=len(rec_rows)))
        story.append(rec_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # SECTION 10: Analysis History & Audit Log Excerpt
    # =========================================================================
    story.append(Paragraph("10. Analysis History & Audit Log Excerpt", styles["SectionHeading"]))
    audit_data = report_data.get("audit_excerpt", {})
    is_valid = audit_data.get("audit_chain_valid", False)
    valid_color = "#15803d" if is_valid else "#b91c1c"
    valid_str = "VALID (CRYPTOGRAPHICALLY VERIFIED)" if is_valid else "CORRUPTED (HASH MISMATCH)"

    story.append(
        Paragraph(
            f"<b>Audit Chain Integrity:</b> <font color='{valid_color}'><b>{safe_text(valid_str)}</b></font> &nbsp;|&nbsp; "
            f"Total Chained Entries: <b>{safe_text(audit_data.get('audit_count', 0))}</b>",
            styles["Body"],
        )
    )

    audit_entries = audit_data.get("entries", [])
    if audit_entries:
        a_rows = [[
            Paragraph("ID & Time", styles["TableHead"]),
            Paragraph("Actor", styles["TableHead"]),
            Paragraph("Action", styles["TableHead"]),
            Paragraph("Target", styles["TableHead"]),
            Paragraph("Hash Chaining (Prev &rarr; Entry)", styles["TableHead"]),
        ]]
        for a in audit_entries[-15:]:  # Latest 15 entries in excerpt
            prev_short = str(a.get("prev_hash", ""))[:12] + "..." if len(str(a.get("prev_hash", ""))) > 12 else a.get("prev_hash", "")
            entry_short = str(a.get("entry_hash", ""))[:12] + "..." if len(str(a.get("entry_hash", ""))) > 12 else a.get("entry_hash", "")
            chain_label = f"{safe_text(prev_short)} &rarr; <b>{safe_text(entry_short)}</b>"
            a_rows.append([
                Paragraph(f"#{safe_text(a.get('id'))}<br/>{safe_text(a.get('ts'))}", styles["TableCell"]),
                Paragraph(safe_text(a.get("actor")), styles["TableCellBold"]),
                Paragraph(safe_text(a.get("action")), styles["TableCell"]),
                Paragraph(safe_text(a.get("target")), styles["TableCellCode"]),
                Paragraph(chain_label, styles["TableCellCode"]),
            ])
        a_table = Table(a_rows, colWidths=[100, 55, 85, 90, 210])
        a_table.setStyle(_make_table_style(has_header=True, num_rows=len(a_rows)))
        story.append(a_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECTION 11: Report Integrity Footer
    # =========================================================================
    report_sha256 = report_data.get("report_json_sha256", "UNKNOWN")
    footer_data = [
        [
            Paragraph(
                "11. Report Integrity Footer",
                styles["SectionHeading"],
            )
        ],
        [
            Paragraph(
                "The hash below is computed deterministically over the canonical JSON payload "
                "excluding this hash field. Any subsequent tampering or alteration of database "
                "records or report metadata will invalidate this digital fingerprint.",
                styles["CalloutText"],
            )
        ],
        [
            Paragraph(
                f"<b>report_json_sha256:</b> <font color='#0f172a'><b>{safe_text(report_sha256)}</b></font>",
                styles["FooterHash"],
            )
        ],
    ]
    footer_table = Table(footer_data, colWidths=[540])
    footer_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(footer_table)

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path
