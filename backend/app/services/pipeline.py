"""backend/app/services/pipeline.py

Pipeline coordinator and state machine for TruthLens X.
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Case state machine: created/ingested -> analyzing -> analyzed -> correlated -> in_review -> reported
- Wraps every analyzer invocation in try/except; exceptions become status="failed" with human error
- Runs audio analyzer on both audio files AND video files (extracting audio track + transcript)
- Feeds transcripts into text analyzer for caption vs. transcript comparison
- Executes Cross-Modal Correlation Engine (Rules R1-R8)
- Builds Provenance Timeline and computes case review_priority
- Records hash-chained audit log
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.services.audit import append_audit
from shared.schemas import (
    AnalysisContext,
    AnalyzerResult,
    Claim,
    GraphEdge,
    Modality,
    Observation,
    Strength,
    TimelineEvent
)

from backend.app.analyzers.image import run as image_analyzer
from backend.app.analyzers.video import run as video_analyzer
from backend.app.analyzers.audio import run as audio_analyzer
from backend.app.analyzers.text import run as text_analyzer
from backend.app.analyzers.provenance.c2pa_check import inspect_c2pa
from backend.app.analyzers.plugins.detector_hook import run_optional_detector, is_detector_enabled
from backend.app.correlation.rules import evaluate_correlation_rules
from backend.app.correlation.strength import compute_case_review_priority
from backend.app.correlation.timeline import build_case_timeline


def save_analysis_run(
    run_id: str,
    evidence_id: str,
    analyzer: str,
    tool_version: str,
    status: str,
    error: Optional[str],
    started_at: str,
    finished_at: str,
    params: Optional[Dict[str, Any]] = None
) -> None:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO analysis_runs
            (id, evidence_id, analyzer, tool_version, params_json, status, error, started_at, finished_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id, evidence_id, analyzer, tool_version,
                json.dumps(params or {}), status, error, started_at, finished_at
            )
        )


def persist_analyzer_result(
    case_id: str,
    evidence_id: str,
    run_id: str,
    result: AnalyzerResult
) -> None:
    """Persists observations, claims, and artifacts from an AnalyzerResult."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Store observations
        for obs in result.observations:
            obs_dict = obs.model_dump()
            cursor.execute(
                """
                INSERT OR REPLACE INTO observations
                (id, case_id, evidence_id, run_id, modality, indicator, method,
                 summary, explanation, alternative_explanation, evidence_strength,
                 model_score, model_calibrated, model_name, region_json,
                 time_start_ms, time_end_ms, artifact_ids_json, details_json, limitations)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    obs_dict["id"], case_id, evidence_id, run_id,
                    obs_dict["modality"], obs_dict["indicator"], obs_dict["method"],
                    obs_dict["summary"], obs_dict["explanation"], obs_dict["alternative_explanation"],
                    obs_dict["evidence_strength"], obs_dict["model_score"],
                    1 if obs_dict["model_calibrated"] else 0,
                    obs_dict["model_name"],
                    json.dumps(obs_dict["region"]) if obs_dict.get("region") else None,
                    obs_dict.get("time_start_ms"), obs_dict.get("time_end_ms"),
                    json.dumps(obs_dict.get("artifact_ids", [])),
                    json.dumps(obs_dict.get("details", {})),
                    obs_dict.get("limitations", "")
                )
            )

        # Store claims
        for claim in result.claims:
            c_dict = claim.model_dump()
            cursor.execute(
                """
                INSERT OR REPLACE INTO claims
                (id, case_id, source_evidence_id, source_kind, text, claim_type, value_json, time_start_ms, time_end_ms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    c_dict["id"], case_id, evidence_id, c_dict["source_kind"],
                    c_dict["text"], c_dict["claim_type"],
                    json.dumps(c_dict["value"]),
                    c_dict.get("time_start_ms"), c_dict.get("time_end_ms")
                )
            )

        # Store artifacts
        for art in result.artifacts:
            cursor.execute(
                """
                INSERT OR REPLACE INTO artifacts
                (id, case_id, run_id, kind, path, sha256, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    art["id"], case_id, run_id, art.get("kind", "artifact"),
                    art.get("path", ""), art.get("sha256", ""), art.get("description", "")
                )
            )


def run_case_pipeline(case_id: str) -> Dict[str, Any]:
    """
    Executes the multimodal forensic pipeline and correlation engine for a given case.
    Transitions: (created/ingested) -> analyzing -> analyzed -> correlated.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, status FROM cases WHERE id = ?", (case_id,))
        case_row = cursor.fetchone()
        if not case_row:
            return {"status": "failed", "error": f"Case '{case_id}' not found."}

        # Advance state to analyzing
        cursor.execute("UPDATE cases SET status = 'analyzing' WHERE id = ?", (case_id,))

        # Fetch active evidence
        cursor.execute(
            "SELECT * FROM evidence WHERE case_id = ? AND deleted_at IS NULL ORDER BY uploaded_at ASC",
            (case_id,)
        )
        evidence_items = [dict(row) for row in cursor.fetchall()]

    pipeline_errors: List[str] = []
    collected_transcripts: List[str] = []
    all_runs: List[Dict[str, Any]] = []

    # Stage 1: Analyze Media Items (Image, Video, Audio)
    media_evidence = [e for e in evidence_items if e.get("kind") in ("image", "video", "audio")]
    text_evidence = [e for e in evidence_items if e.get("kind") in ("text", "caption")]

    for ev in media_evidence:
        kind = ev.get("kind")
        ev_id = ev["id"]

        artifact_dir = settings.artifacts_dir / case_id / ev_id
        artifact_dir.mkdir(parents=True, exist_ok=True)
        ctx = AnalysisContext(
            case_id=case_id,
            work_dir=str(settings.tmp_dir),
            artifact_dir=str(artifact_dir),
            config={}
        )

        if kind == "image":
            run_id = f"run_img_{uuid4().hex[:8]}"
            started = datetime.now(timezone.utc).isoformat()
            try:
                res = image_analyzer.analyze(ev, ctx)
            except Exception as e:
                res = AnalyzerResult(status="failed", error=str(e), tool_version="1.0.0")
                pipeline_errors.append(f"Image {ev_id}: {e}")
            finished = datetime.now(timezone.utc).isoformat()
            save_analysis_run(run_id, ev_id, "image_analyzer", "1.0.0", res.status, res.error, started, finished)
            persist_analyzer_result(case_id, ev_id, run_id, res)
            all_runs.append({"id": run_id, "analyzer": "image_analyzer", "status": res.status, "started_at": started, "finished_at": finished})

        elif kind == "video":
            # 1. Video Analyzer (probe, scene cuts, pts, frames)
            run_id_v = f"run_vid_{uuid4().hex[:8]}"
            started_v = datetime.now(timezone.utc).isoformat()
            try:
                res_v = video_analyzer.analyze(ev, ctx)
            except Exception as e:
                res_v = AnalyzerResult(status="failed", error=str(e), tool_version="1.0.0")
                pipeline_errors.append(f"Video {ev_id}: {e}")
            finished_v = datetime.now(timezone.utc).isoformat()
            save_analysis_run(run_id_v, ev_id, "video_analyzer", "1.0.0", res_v.status, res_v.error, started_v, finished_v)
            persist_analyzer_result(case_id, ev_id, run_id_v, res_v)
            all_runs.append({"id": run_id_v, "analyzer": "video_analyzer", "status": res_v.status, "started_at": started_v, "finished_at": finished_v})

            # 2. Audio Analyzer on Video (extract mono audio, spectrogram, acoustic discontinuities, transcript)
            run_id_a = f"run_aud_{uuid4().hex[:8]}"
            started_a = datetime.now(timezone.utc).isoformat()
            try:
                res_a = audio_analyzer.analyze(ev, ctx)
            except Exception as e:
                res_a = AnalyzerResult(status="failed", error=str(e), tool_version="1.0.0")
                pipeline_errors.append(f"Video Audio {ev_id}: {e}")
            finished_a = datetime.now(timezone.utc).isoformat()
            save_analysis_run(run_id_a, ev_id, "audio_analyzer", "1.0.0", res_a.status, res_a.error, started_a, finished_a)
            persist_analyzer_result(case_id, ev_id, run_id_a, res_a)
            all_runs.append({"id": run_id_a, "analyzer": "audio_analyzer", "status": res_a.status, "started_at": started_a, "finished_at": finished_a})

            # Harvest transcript if generated
            tr_text = res_a.metadata.get("transcription", {}).get("full_text")
            if tr_text:
                collected_transcripts.append(tr_text)

        elif kind == "audio":
            run_id = f"run_aud_{uuid4().hex[:8]}"
            started = datetime.now(timezone.utc).isoformat()
            try:
                res = audio_analyzer.analyze(ev, ctx)
            except Exception as e:
                res = AnalyzerResult(status="failed", error=str(e), tool_version="1.0.0")
                pipeline_errors.append(f"Audio {ev_id}: {e}")
            finished = datetime.now(timezone.utc).isoformat()
            save_analysis_run(run_id, ev_id, "audio_analyzer", "1.0.0", res.status, res.error, started, finished)
            persist_analyzer_result(case_id, ev_id, run_id, res)
            all_runs.append({"id": run_id, "analyzer": "audio_analyzer", "status": res.status, "started_at": started, "finished_at": finished})

            tr_text = res.metadata.get("transcription", {}).get("full_text")
            if tr_text:
                collected_transcripts.append(tr_text)

        # Provenance: C2PA Content Credentials Manifest Check
        stored_p_str = ev.get("stored_path", "")
        if stored_p_str:
            p_obj = Path(stored_p_str)
            if not p_obj.is_absolute():
                p_obj = (settings.data_path.parent / p_obj).resolve()
            if p_obj.exists():
                c2pa_obs, c2pa_events, c2pa_meta = inspect_c2pa(ev_id, case_id, p_obj, Modality(kind))
                if c2pa_obs:
                    run_id_c2pa = f"run_c2pa_{uuid4().hex[:8]}"
                    now_c2pa = datetime.now(timezone.utc).isoformat()
                    save_analysis_run(run_id_c2pa, ev_id, "c2pa_provenance_inspector", "1.0.0", "done", None, now_c2pa, now_c2pa)
                    persist_analyzer_result(case_id, ev_id, run_id_c2pa, AnalyzerResult(status="done", observations=c2pa_obs, tool_version="1.0.0"))

        # Optional Pretrained Classifier Plug-in (Guarded by ENABLE_OPTIONAL_MODELS)
        if is_detector_enabled():
            det_st, det_obs, det_telemetry = run_optional_detector(ev, ctx, Modality(kind))
            if det_obs:
                run_id_det = f"run_det_{uuid4().hex[:8]}"
                now_det = datetime.now(timezone.utc).isoformat()
                save_analysis_run(run_id_det, ev_id, "pretrained_detector_plugin", "1.0.0", det_st, None, now_det, now_det)
                persist_analyzer_result(case_id, ev_id, run_id_det, AnalyzerResult(status=det_st, observations=[det_obs], tool_version="1.0.0"))

    # If no audio transcript was harvested from media, check if a text evidence item is a transcript
    if not collected_transcripts:
        for ev in text_evidence:
            orig = (ev.get("original_name") or "").lower()
            note = (ev.get("source_note") or "").lower()
            if "transcript" in orig or "transcript" in note:
                p = Path(ev["stored_path"])
                if p.exists():
                    try:
                        with open(p, "r", encoding="utf-8", errors="ignore") as f:
                            t_content = f.read()
                            if t_content.strip():
                                collected_transcripts.append(t_content.strip())
                    except Exception:
                        pass

    # Combined transcript text for text comparison
    combined_transcript_text = " ".join(collected_transcripts)

    # Stage 2: Analyze Text / Caption Evidence
    for ev in text_evidence:
        ev_id = ev["id"]
        run_id = f"run_txt_{uuid4().hex[:8]}"
        started = datetime.now(timezone.utc).isoformat()

        artifact_dir = settings.artifacts_dir / case_id / ev_id
        artifact_dir.mkdir(parents=True, exist_ok=True)
        ctx = AnalysisContext(
            case_id=case_id,
            work_dir=str(settings.tmp_dir),
            artifact_dir=str(artifact_dir),
            config={"transcript": combined_transcript_text}
        )

        try:
            res = text_analyzer.analyze(ev, ctx)
        except Exception as e:
            res = AnalyzerResult(status="failed", error=str(e), tool_version="1.0.0")
            pipeline_errors.append(f"Text {ev_id}: {e}")
        finished = datetime.now(timezone.utc).isoformat()
        save_analysis_run(run_id, ev_id, "text_analyzer", "1.0.0", res.status, res.error, started, finished)
        persist_analyzer_result(case_id, ev_id, run_id, res)
        all_runs.append({"id": run_id, "analyzer": "text_analyzer", "status": res.status, "started_at": started, "finished_at": finished})

    # Transition status: analyzing -> analyzed
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE cases SET status = 'analyzed' WHERE id = ?", (case_id,))

    # Stage 3: Execute Cross-Modal Correlation Engine (Rules R1 - R8)
    # Query all active observations and claims for this case
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM observations WHERE case_id = ?", (case_id,))
        obs_rows = cursor.fetchall()

        cursor.execute("SELECT * FROM claims WHERE case_id = ?", (case_id,))
        claim_rows = cursor.fetchall()

        cursor.execute("SELECT * FROM review_decisions WHERE case_id = ?", (case_id,))
        review_rows = [dict(r) for r in cursor.fetchall()]

    all_obs: List[Observation] = []
    for r in obs_rows:
        all_obs.append(
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
                region=json.loads(r["region_json"]) if r["region_json"] else None,
                time_start_ms=r["time_start_ms"],
                time_end_ms=r["time_end_ms"],
                artifact_ids=json.loads(r["artifact_ids_json"] or "[]"),
                details=json.loads(r["details_json"] or "{}"),
                limitations=r["limitations"] or ""
            )
        )

    all_claims: List[Claim] = []
    for r in claim_rows:
        all_claims.append(
            Claim(
                id=r["id"],
                case_id=r["case_id"],
                source_evidence_id=r["source_evidence_id"],
                source_kind=r["source_kind"],
                text=r["text"],
                claim_type=r["claim_type"],
                value=json.loads(r["value_json"] or "{}"),
                time_start_ms=r["time_start_ms"],
                time_end_ms=r["time_end_ms"]
            )
        )

    # Evaluate Rules R1 - R8
    correlation_edges = evaluate_correlation_rules(
        case_id=case_id,
        evidence_list=evidence_items,
        observations=all_obs,
        claims=all_claims
    )

    # Build Unified Provenance Timeline
    timeline_res = build_case_timeline(
        case_id=case_id,
        evidence_list=evidence_items,
        observations=all_obs,
        claims=all_claims,
        analysis_runs=all_runs,
        review_decisions=review_rows
    )

    # Compute Case Review Priority
    priority_res = compute_case_review_priority(all_obs, correlation_edges)

    # Persist Graph Edges, Timeline Events, and Update Case Status
    with get_db() as conn:
        cursor = conn.cursor()

        # Persist Graph Edges
        cursor.execute("DELETE FROM graph_edges WHERE case_id = ?", (case_id,))
        for edge in correlation_edges:
            cursor.execute(
                """
                INSERT INTO graph_edges
                (id, case_id, src_id, dst_id, relation, rule, evidence_observation_ids_json, explanation, alternative_explanation, strength)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    edge.id, case_id, edge.src_id, edge.dst_id, edge.relation, edge.rule,
                    json.dumps(edge.evidence_observation_ids), edge.explanation,
                    edge.alternative_explanation, edge.strength.value
                )
            )

        # Persist Timeline Events
        cursor.execute("DELETE FROM timeline_events WHERE case_id = ?", (case_id,))
        for evt in timeline_res.events:
            cursor.execute(
                """
                INSERT INTO timeline_events
                (id, case_id, ts, media_time_ms, kind, ref_id, label)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (evt.id, case_id, evt.ts, evt.media_time_ms, evt.kind, evt.ref_id, evt.label)
            )

        # Update case status to correlated
        cursor.execute("UPDATE cases SET status = 'correlated' WHERE id = ?", (case_id,))

        # Record audit log
        append_audit(
            case_id=case_id,
            actor="system",
            action="RUN_ANALYSIS",
            target=case_id,
            details={
                "evidence_processed": len(evidence_items),
                "observations_count": len(all_obs),
                "claims_count": len(all_claims),
                "edges_count": len(correlation_edges),
                "review_priority": priority_res["review_priority"],
                "errors": pipeline_errors
            },
            conn=conn
        )

    return {
        "case_id": case_id,
        "status": "correlated",
        "evidence_count": len(evidence_items),
        "observations_count": len(all_obs),
        "claims_count": len(all_claims),
        "edges_count": len(correlation_edges),
        "review_priority": priority_res,
        "errors": pipeline_errors
    }
