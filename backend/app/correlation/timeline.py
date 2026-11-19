"""backend/app/correlation/timeline.py

Unified Chronological Provenance Timeline Builder for TruthLens X.
Merges:
1. Ingestion / Upload events with SHA-256
2. Container (creation_time) / EXIF (DateTimeOriginal) timestamps
3. Analysis runs (tool, version, status)
4. Media-time observations (media_time_ms)
5. Human review decisions (append-only)
"""

from typing import Any, Dict, List, Optional
from uuid import uuid4

from shared.schemas import Claim, Observation, TimelineEvent, TimelineResponse


def build_case_timeline(
    case_id: str,
    evidence_list: List[Dict[str, Any]],
    observations: List[Observation],
    claims: List[Claim],
    analysis_runs: Optional[List[Dict[str, Any]]] = None,
    review_decisions: Optional[List[Dict[str, Any]]] = None
) -> TimelineResponse:
    """
    Constructs a unified, sorted chronological timeline across both real-world absolute time (ts)
    and media playback time (media_time_ms).
    """
    events: List[TimelineEvent] = []
    analysis_runs = analysis_runs or []
    review_decisions = review_decisions or []

    # 1. Ingestion / Upload Events
    for ev in evidence_list:
        ev_id = ev.get("id", "")
        h = ev.get("sha256", "")
        uploaded_at = ev.get("uploaded_at")
        name = ev.get("original_name") or ev_id
        events.append(
            TimelineEvent(
                id=f"tl_up_{uuid4().hex[:8]}",
                case_id=case_id,
                ts=uploaded_at,
                media_time_ms=None,
                kind="upload",
                ref_id=ev_id,
                label=f"Evidence ingested: {name} (SHA-256: {h[:12]}...)"
            )
        )

    # 2. Container / EXIF Timestamps from Claims
    for cl in claims:
        if cl.source_kind in ("exif", "metadata") and cl.claim_type == "datetime":
            iso_val = cl.value.get("iso8601") or cl.value.get("creation_time") or cl.value.get("datetime_original")
            events.append(
                TimelineEvent(
                    id=f"tl_meta_{uuid4().hex[:8]}",
                    case_id=case_id,
                    ts=str(iso_val) if iso_val else None,
                    media_time_ms=None,
                    kind="exif_timestamp" if cl.source_kind == "exif" else "metadata_timestamp",
                    ref_id=cl.id,
                    label=f"Media capture timestamp: {cl.text}"
                )
            )

    # 3. Analysis Runs
    for run in analysis_runs:
        run_id = run.get("id", "")
        tool = run.get("analyzer", "analyzer")
        ver = run.get("tool_version", "1.0.0")
        st = run.get("status", "done")
        ts = run.get("finished_at") or run.get("started_at")
        events.append(
            TimelineEvent(
                id=f"tl_run_{uuid4().hex[:8]}",
                case_id=case_id,
                ts=ts,
                media_time_ms=None,
                kind="analysis_run",
                ref_id=run_id,
                label=f"Analyzer executed: {tool} v{ver} ({st})"
            )
        )

    # 4. Media-Time Observations
    for obs in observations:
        if obs.time_start_ms is not None:
            events.append(
                TimelineEvent(
                    id=f"tl_obs_{uuid4().hex[:8]}",
                    case_id=case_id,
                    ts=None,
                    media_time_ms=obs.time_start_ms,
                    kind=obs.indicator,
                    ref_id=obs.id,
                    label=f"[{round(obs.time_start_ms / 1000.0, 2)}s] {obs.summary}"
                )
            )

    # 5. Review Decisions
    for rev in review_decisions:
        rev_id = rev.get("id", "")
        dec = rev.get("decision", "inconclusive")
        reviewer = rev.get("reviewer", "reviewer")
        decided_at = rev.get("decided_at")
        target_id = rev.get("target_id", "")
        events.append(
            TimelineEvent(
                id=f"tl_rev_{uuid4().hex[:8]}",
                case_id=case_id,
                ts=decided_at,
                media_time_ms=None,
                kind="review",
                ref_id=rev_id,
                label=f"Human Review ({dec.upper()} by {reviewer}) on {target_id}"
            )
        )

    # Sort events: first by absolute ts (if present), then by media_time_ms
    def sort_key(e: TimelineEvent):
        ts_val = e.ts or "9999-99-99T99:99:99"
        m_val = e.media_time_ms if e.media_time_ms is not None else -1
        return (ts_val, m_val)

    events.sort(key=sort_key)

    return TimelineResponse(
        case_id=case_id,
        events=events
    )

