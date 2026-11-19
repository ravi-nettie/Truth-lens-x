"""backend/app/analyzers/text/run.py

Pure-function text analyzer orchestrator for TruthLens X (Module 13D).
Adheres strictly to Rule 1, Rule 2, and Rule 3:
- Signature: def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult
- CPU-only, 100% offline, local-first
- Pure function: no DB access, no modification of original files
- Never raises unhandled exceptions (returns status="failed" with human-readable error)
- Hard cap: Text-only mismatches never exceed moderate strength
- Extracts numbers, temporal expressions, entities, and performs cross-modal comparison
"""

import os
from pathlib import Path
from typing import Any, Dict, List

from shared.schemas import AnalysisContext, AnalyzerResult, Claim, Observation
from backend.app.analyzers.text.claims import text_to_claims
from backend.app.analyzers.text.compare import compare_caption_and_transcript


def analyze(evidence: Dict[str, Any], ctx: AnalysisContext) -> AnalyzerResult:
    """
    Forensic text analyzer executing number parsing, temporal extraction,
    named entity recognition, and caption-vs-transcript cross-modal comparison.
    """
    evidence_id = evidence.get("id", "unknown_evidence")
    case_id = ctx.case_id
    stored_path_str = evidence.get("stored_path")

    # Read text either from file or from source_note / text attribute
    raw_text = ""
    if stored_path_str and os.path.exists(stored_path_str):
        try:
            with open(stored_path_str, "r", encoding="utf-8", errors="replace") as f:
                raw_text = f.read()
        except Exception as e:
            return AnalyzerResult(
                status="failed",
                error=f"Failed to read text evidence file: {str(e)}",
                tool_version="1.0.0"
            )
    else:
        raw_text = evidence.get("text") or evidence.get("source_note") or ""

    if not raw_text.strip():
        return AnalyzerResult(
            status="done",
            observations=[],
            claims=[],
            artifacts=[],
            metadata={"modality": "text", "empty": True},
            tool_version="1.0.0"
        )

    all_observations: List[Observation] = []
    all_claims: List[Claim] = []
    all_artifacts: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {
        "modality": "text",
        "char_count": len(raw_text),
        "word_count": len(raw_text.split()),
    }

    try:
        # 1. Synthesize Caption Claims (Numbers, Times, Entities)
        caption_claims = text_to_claims(
            case_id=case_id,
            source_evidence_id=evidence_id,
            text=raw_text,
            source_kind="caption"
        )
        all_claims.extend(caption_claims)
        metadata["extracted_claims_count"] = len(caption_claims)

        # 2. Check if a companion transcript exists in context or evidence
        transcript_text = (
            evidence.get("transcript") or
            ctx.config.get("transcript") or
            ""
        )
        transcript_claims = ctx.config.get("transcript_claims", [])

        if transcript_text:
            if not transcript_claims:
                transcript_claims = text_to_claims(
                    case_id=case_id,
                    source_evidence_id=evidence_id,
                    text=transcript_text,
                    source_kind="transcript"
                )
            all_claims.extend(transcript_claims)

            # Compare caption and transcript
            cmp_obs, cmp_meta = compare_caption_and_transcript(
                case_id=case_id,
                evidence_id=evidence_id,
                caption_text=raw_text,
                transcript_text=transcript_text,
                caption_claims=caption_claims,
                transcript_claims=transcript_claims
            )
            all_observations.extend(cmp_obs)
            metadata["cross_modal_comparison"] = cmp_meta

        return AnalyzerResult(
            status="done",
            observations=all_observations,
            claims=all_claims,
            artifacts=all_artifacts,
            metadata=metadata,
            tool_version="1.0.0"
        )

    except Exception as e:
        return AnalyzerResult(
            status="failed",
            error=f"Text analyzer error: {str(e)}",
            tool_version="1.0.0"
        )
