"""shared/schemas.py

Pydantic v2 shared schemas for TruthLens X.
Enforces non-negotiable engineering rules:
- Forensic honesty & plain-language explanations
- No fake/deepfake percentages
- Uncalibrated model labeling
- Required alternative explanations for weak/moderate observations & CONTRADICTS edges
- Pydantic validation boundaries
"""

from __future__ import annotations

from enum import Enum
from typing import Any, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Enums
# ============================================================================

class Modality(str, Enum):
    image = "image"
    video = "video"
    audio = "audio"
    text = "text"
    case = "case"


class Strength(str, Enum):
    informational = "informational"
    weak = "weak"
    moderate = "moderate"
    strong = "strong"


class ErrorCode(str, Enum):
    UNSUPPORTED_TYPE = "UNSUPPORTED_TYPE"
    TOO_LARGE = "TOO_LARGE"
    CORRUPT_FILE = "CORRUPT_FILE"
    MODEL_MISSING = "MODEL_MISSING"
    ANALYZER_FAILED = "ANALYZER_FAILED"
    NOT_FOUND = "NOT_FOUND"
    BAD_REQUEST = "BAD_REQUEST"


class ReviewDecision(str, Enum):
    confirmed = "confirmed"
    disputed = "disputed"
    inconclusive = "inconclusive"
    dismissed = "dismissed"
    needs_more_work = "needs_more_work"


# ============================================================================
# Core Primitives
# ============================================================================

class Region(BaseModel):
    x: int = Field(..., description="Top-left X coordinate in pixels")
    y: int = Field(..., description="Top-left Y coordinate in pixels")
    w: int = Field(..., description="Width in pixels")
    h: int = Field(..., description="Height in pixels")
    frame_index: Optional[int] = Field(default=None, description="Optional video frame index")


class Observation(BaseModel):
    id: str = Field(..., description="Unique observation ID (e.g. obs_<sha256> or obs_<uuid>)")
    case_id: str = Field(..., description="Case identifier")
    evidence_id: str = Field(..., description="Source evidence identifier")
    modality: Modality = Field(..., description="Modality under observation")
    indicator: str = Field(..., description="Technical indicator (e.g. audio_discontinuity, copy_move, scene_cut)")
    method: str = Field(..., description="Forensic method used to detect indicator")
    summary: str = Field(..., description="High-level summary for reviewers")
    explanation: str = Field(..., description="Technical details of observed anomaly or signal")
    alternative_explanation: str = Field(
        default="",
        description="Plausible benign explanation (mandatory for weak and moderate strength observations)"
    )
    evidence_strength: Strength = Field(..., description="Forensic evidence strength")
    model_score: Optional[float] = Field(
        default=None,
        description="Optional uncalibrated model score. Never represent as a global fake probability."
    )
    model_calibrated: bool = Field(
        default=False,
        description="Must remain False for any pretrained ML score in compliance with forensic honesty rules."
    )
    model_name: Optional[str] = Field(default=None, description="Name of the model if an ML analyzer was used")
    region: Optional[Region] = Field(default=None, description="Spatial bounding box if applicable")
    time_start_ms: Optional[int] = Field(default=None, description="Start offset in milliseconds for time-based media")
    time_end_ms: Optional[int] = Field(default=None, description="End offset in milliseconds for time-based media")
    artifact_ids: list[str] = Field(default_factory=list, description="IDs of derived artifact files")
    details: dict[str, Any] = Field(default_factory=dict, description="Raw analyzer-specific telemetry")
    limitations: str = Field(
        default="",
        description="Forensic limitations and scope bounds (mandatory for weak and moderate observations)"
    )

    @model_validator(mode="after")
    def validate_forensic_honesty(self) -> "Observation":
        # Rule 2: Pretrained ML scores must set model_calibrated=False
        if self.model_score is not None and self.model_calibrated is not False:
            raise ValueError(
                "Forensic Rule 2 Violation: any pretrained ML score must set model_calibrated=False "
                "and be labeled as an uncalibrated model output."
            )

        # Rule 2: Every weak or moderate observation MUST include alternative_explanation and limitations
        if self.evidence_strength in (Strength.weak, Strength.moderate):
            if not self.alternative_explanation or not self.alternative_explanation.strip():
                raise ValueError(
                    f"Forensic Rule 2 Violation: Observation '{self.id}' with strength '{self.evidence_strength.value}' "
                    f"must include a non-empty 'alternative_explanation'."
                )
            if not self.limitations or not self.limitations.strip():
                raise ValueError(
                    f"Forensic Rule 2 Violation: Observation '{self.id}' with strength '{self.evidence_strength.value}' "
                    f"must include a non-empty 'limitations' statement."
                )

        # Rule 2: Missing EXIF or ordinary video scene cuts alone are informational, never suspicious by themselves
        if self.indicator in ("missing_exif", "video_scene_cut") and self.evidence_strength != Strength.informational:
            raise ValueError(
                f"Forensic Rule 2 Violation: Indicator '{self.indicator}' alone must be marked "
                f"'informational', never suspicious by itself."
            )

        # Rule 2: Text-only mismatches cap at moderate strength
        if self.modality == Modality.text and self.evidence_strength == Strength.strong:
            raise ValueError(
                "Forensic Rule 2 Violation: Text-only observations cap at 'moderate' strength."
            )

        return self


class Claim(BaseModel):
    id: str = Field(..., description="Unique claim identifier")
    case_id: str = Field(..., description="Case identifier")
    source_evidence_id: str = Field(..., description="Evidence item from which claim was extracted")
    source_kind: Literal["caption", "transcript", "metadata", "exif"] = Field(..., description="Source kind")
    text: str = Field(..., description="Raw text of the extracted claim")
    claim_type: Literal["number", "datetime", "entity", "location", "statement"] = Field(..., description="Claim type")
    value: dict[str, Any] = Field(..., description="Structured extracted payload (e.g. parsed value, entity type)")
    time_start_ms: Optional[int] = Field(default=None, description="Start offset in milliseconds if speech/video")
    time_end_ms: Optional[int] = Field(default=None, description="End offset in milliseconds if speech/video")


class GraphEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    case_id: str = Field(..., description="Case identifier")
    src_id: str = Field(..., description="Source node ID (observation or claim ID)")
    dst_id: str = Field(..., description="Destination node ID (observation or claim ID)")
    relation: Literal["SUPPORTS", "CONTRADICTS", "CO_OCCURS", "DERIVED_FROM", "NEEDS_REVIEW"] = Field(
        ..., description="Correlation relationship"
    )
    rule: str = Field(..., description="Correlation rule name or code (e.g. R3_number_mismatch, R7_audio_visual_cut)")
    evidence_observation_ids: list[str] = Field(
        ...,
        min_length=1,
        description="IDs of observations supporting this edge; must have at least one supporting observation"
    )
    explanation: str = Field(..., description="Human-readable explanation of why these nodes are linked")
    alternative_explanation: str = Field(
        default="",
        description="Benign alternative explanation (mandatory for CONTRADICTS relations)"
    )
    strength: Strength = Field(..., description="Strength of the correlation edge")

    @model_validator(mode="after")
    def validate_contradiction_requirements(self) -> "GraphEdge":
        # Rule 2: Every CONTRADICTS edge MUST include a plain-language alternative_explanation
        if self.relation == "CONTRADICTS":
            if not self.alternative_explanation or not self.alternative_explanation.strip():
                raise ValueError(
                    f"Forensic Rule 2 Violation: GraphEdge '{self.id}' with relation 'CONTRADICTS' "
                    f"must include a non-empty 'alternative_explanation'."
                )
        return self


class TimelineEvent(BaseModel):
    id: str = Field(..., description="Unique timeline event identifier")
    case_id: str = Field(..., description="Case identifier")
    ts: Optional[str] = Field(default=None, description="Absolute ISO8601 timestamp if available")
    media_time_ms: Optional[int] = Field(default=None, description="Media timeline offset in milliseconds")
    kind: str = Field(..., description="Event kind (upload, exif_timestamp, scene_cut, observation, review)")
    ref_id: str = Field(..., description="Referenced entity ID (evidence_id, observation_id, review_id)")
    label: str = Field(..., description="Concise human-readable label")


class AnalyzerResult(BaseModel):
    status: Literal["done", "failed", "skipped_missing_model"] = Field(..., description="Execution status")
    error: Optional[str] = Field(default=None, description="Human-readable error message if failed")
    observations: list[Observation] = Field(default_factory=list, description="Extracted observations")
    claims: list[Claim] = Field(default_factory=list, description="Extracted factual claims")
    artifacts: list[dict[str, Any]] = Field(default_factory=list, description="Derived artifact descriptors")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Extracted technical metadata")
    tool_version: str = Field(default="", description="Version identifier of analyzer tool")


class AnalysisContext(BaseModel):
    case_id: str = Field(..., description="Active case identifier")
    work_dir: str = Field(..., description="Path to temporary sandbox working directory")
    artifact_dir: str = Field(..., description="Path to derived artifacts destination")
    config: dict[str, Any] = Field(default_factory=dict, description="Runtime configuration dictionary")


# ============================================================================
# API Error Envelope
# ============================================================================

class ErrorDetail(BaseModel):
    code: ErrorCode = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error explanation")
    detail: Optional[Any] = Field(default=None, description="Optional extra error details or stack context")


class ErrorResponse(BaseModel):
    error: ErrorDetail = Field(..., description="Standardized error envelope")


# ============================================================================
# Request / Response DTOs
# ============================================================================

# --- Cases ---
class CaseCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Case title")
    description: Optional[str] = Field(default="", max_length=2000, description="Case description")
    notes: Optional[str] = Field(default="", description="Case notes")


class CaseResponse(BaseModel):
    id: str = Field(..., description="Case ID")
    title: str = Field(..., description="Case title")
    description: Optional[str] = Field(default="", description="Case description")
    created_at: str = Field(..., description="ISO timestamp")
    updated_at: str = Field(..., description="ISO timestamp")
    evidence_count: int = Field(default=0, description="Total evidence items associated")
    status: str = Field(default="open", description="Case review status")
    review_priority: Optional[str] = Field(default="low", description="Triage priority level")


class CaseListResponse(BaseModel):
    cases: list[CaseResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class CaseDetailResponse(BaseModel):
    case: CaseResponse
    evidence_items: list["EvidenceResponse"] = Field(default_factory=list)
    observation_count: int = Field(default=0)
    claim_count: int = Field(default=0)
    contradiction_count: int = Field(default=0)


# --- Evidence ---
class EvidenceResponse(BaseModel):
    id: str = Field(..., description="Evidence ID")
    case_id: str = Field(..., description="Associated case ID")
    filename: str = Field(..., description="Original uploaded filename")
    sha256: str = Field(..., description="SHA-256 hash of read-only original file")
    modality: Modality = Field(..., description="Media modality")
    mime_type: str = Field(..., description="MIME content type")
    file_size_bytes: int = Field(..., description="Original file size in bytes")
    file_path: str = Field(..., description="Internal read-only storage path")
    created_at: str = Field(..., description="ISO timestamp of ingestion")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Extracted container metadata")
    kind: Optional[str] = Field(default=None, description="Modality/kind alias")
    original_name: Optional[str] = Field(default=None, description="Original filename alias")
    stored_path: Optional[str] = Field(default=None, description="Stored path alias")
    size_bytes: Optional[int] = Field(default=None, description="Size in bytes alias")
    mime: Optional[str] = Field(default=None, description="MIME type alias")
    uploaded_at: Optional[str] = Field(default=None, description="Upload timestamp alias")
    source_note: Optional[str] = Field(default=None, description="Source notes")
    deleted_at: Optional[str] = Field(default=None, description="Tombstone timestamp if deleted")


class EvidenceUploadResponse(BaseModel):
    evidence: EvidenceResponse
    message: str = Field(default="Evidence ingested and stored in read-only repository.")


class EvidenceListResponse(BaseModel):
    items: list[EvidenceResponse] = Field(default_factory=list)
    total: int = Field(default=0)


# --- Captions & Text Claims ---
class CaptionCreateRequest(BaseModel):
    case_id: str = Field(..., description="Case ID")
    text: str = Field(..., min_length=1, description="Caption or post text accompanying media")
    source: Optional[str] = Field(default="user_input", description="Source of the caption (e.g. social_post, alt_text)")


class CaptionResponse(BaseModel):
    id: str = Field(..., description="Caption evidence ID")
    case_id: str = Field(..., description="Case ID")
    text: str = Field(..., description="Caption text")
    source: str = Field(..., description="Source of caption")
    created_at: str = Field(..., description="ISO timestamp")


# --- Analysis Status ---
class AnalysisStatusResponse(BaseModel):
    case_id: str = Field(..., description="Case identifier")
    status: Literal["idle", "queued", "running", "completed", "failed"] = Field(..., description="Run status")
    progress_percent: float = Field(default=0.0, ge=0.0, le=100.0, description="Analysis progress")
    current_step: Optional[str] = Field(default=None, description="Current analyzer pipeline step")
    errors: list[str] = Field(default_factory=list, description="Any analyzer error strings")


# --- Review Decisions ---
class ReviewCreateRequest(BaseModel):
    case_id: str = Field(..., description="Case ID")
    target_id: str = Field(..., description="ID of observation, claim, edge, or case being reviewed")
    target_type: Literal["observation", "claim", "edge", "case"] = Field(..., description="Target entity type")
    decision: ReviewDecision = Field(..., description="Analyst review verdict")
    notes: str = Field(..., min_length=1, description="Analyst justification notes")
    reviewer: Optional[str] = Field(default="analyst", description="Reviewer name or identifier")


class ObservationReviewRequest(BaseModel):
    decision: ReviewDecision = Field(..., description="Analyst review verdict")
    note: Optional[str] = Field(default=None, description="Analyst justification note")
    notes: Optional[str] = Field(default=None, description="Analyst justification notes")
    reviewer: Optional[str] = Field(default="analyst", description="Reviewer name or identifier")


class ReviewResponse(BaseModel):
    id: str = Field(..., description="Review log ID")
    case_id: str = Field(..., description="Case ID")
    target_id: str = Field(..., description="Target entity ID")
    target_type: str = Field(..., description="Target entity type")
    decision: ReviewDecision = Field(..., description="Review verdict")
    notes: str = Field(..., description="Analyst notes")
    reviewer: str = Field(..., description="Reviewer identifier")
    created_at: str = Field(..., description="ISO timestamp of review submission")


class ReviewListResponse(BaseModel):
    reviews: list[ReviewResponse] = Field(default_factory=list)
    total: int = Field(default=0)


# --- Graph & Correlation ---
class GraphNode(BaseModel):
    id: str = Field(..., description="Node ID (observation, claim, evidence, entity, or anchor ID)")
    label: str = Field(..., description="Display label")
    kind: Literal["observation", "claim", "evidence", "entity", "time_anchor"] = Field(..., description="Node kind")
    modality: Optional[Modality] = Field(default=None, description="Modality if applicable")
    strength: Optional[Strength] = Field(default=None, description="Strength if observation")
    details: dict[str, Any] = Field(default_factory=dict, description="Node metadata")


class GraphResponse(BaseModel):
    case_id: str = Field(..., description="Case identifier")
    nodes: list[GraphNode] = Field(default_factory=list, description="Graph nodes")
    edges: list[GraphEdge] = Field(default_factory=list, description="Graph edges")


# --- Timeline ---
class TimelineResponse(BaseModel):
    case_id: str = Field(..., description="Case identifier")
    events: list[TimelineEvent] = Field(default_factory=list, description="Chronological timeline events")


# --- Reporting ---
class ReportGenerateRequest(BaseModel):
    case_id: Optional[str] = Field(default=None, description="Case identifier")
    format: Literal["json", "pdf", "all"] = Field(default="json", description="Target report format")
    include_artifacts: bool = Field(default=True, description="Whether to include links to derived artifacts")


class ReportResponse(BaseModel):
    report_id: str = Field(..., description="Unique report identifier")
    case_id: str = Field(..., description="Case identifier")
    generated_at: str = Field(..., description="ISO timestamp")
    format: str = Field(default="json", description="Report format (json or pdf)")
    pdf_url: Optional[str] = Field(default=None, description="URL to download PDF report")
    json_url: Optional[str] = Field(default=None, description="URL to download JSON report")
    report_json_sha256: Optional[str] = Field(default=None, description="Canonical SHA-256 hash of JSON report")
    report_json: Optional[dict[str, Any]] = Field(default=None, description="Structured report payload")
    download_url: Optional[str] = Field(default=None, description="URL or relative path to download the report")
