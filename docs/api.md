# TruthLens X — REST API Specification

TruthLens X exposes a clean, standardized HTTP REST API powered by FastAPI.

## Standard Error Envelope

All API errors return a standard envelope structure:

```json
{
  "error": {
    "code": "UNSUPPORTED_TYPE | TOO_LARGE | CORRUPT_FILE | MODEL_MISSING | ANALYZER_FAILED | NOT_FOUND",
    "message": "Human-readable description of error condition",
    "detail": { ... }
  }
}
```

HTTP Status Code Mapping:
- `415 Unsupported Media Type` -> `UNSUPPORTED_TYPE` (e.g. archives, executables, disallow-listed extensions)
- `413 Payload Too Large` -> `TOO_LARGE` (exceeds `MAX_UPLOAD_MB`)
- `422 Unprocessable Content` -> `CORRUPT_FILE` (magic bytes invalid or decoder failure)
- `404 Not Found` -> `NOT_FOUND` (case or evidence item does not exist)
- `503 Service Unavailable` -> `MODEL_MISSING` (required local model weights not found in `models/`)
- `500 Internal Server Error` -> `ANALYZER_FAILED`

---

## Endpoints

### 1. Cases
- `GET /api/v1/cases`: List all active cases (`CaseListResponse`)
- `POST /api/v1/cases`: Create a new case (`CaseCreateRequest` -> `CaseResponse`)
- `GET /api/v1/cases/{case_id}`: Retrieve detailed case summary and associated evidence (`CaseDetailResponse`)

### 2. Evidence Ingestion
- `POST /api/v1/cases/{case_id}/evidence`: Upload media item (`multipart/form-data`)
  - Validates extension, magic byte headers, and size limits.
  - Computes SHA-256 hash and writes to read-only store (`mode 0444`).
  - Returns `EvidenceUploadResponse`.
- `GET /api/v1/cases/{case_id}/evidence`: List all evidence for a case (`EvidenceListResponse`).
- `POST /api/v1/cases/{case_id}/captions`: Ingest accompanying social caption or text post (`CaptionCreateRequest` -> `CaptionResponse`).

### 3. Forensic Analysis Pipeline
- `POST /api/v1/cases/{case_id}/analyze`: Trigger synchronous or background analysis of all ingested evidence.
- `GET /api/v1/cases/{case_id}/status`: Query pipeline progress and status (`AnalysisStatusResponse`).

### 4. Correlation Graph & Timeline
- `GET /api/v1/cases/{case_id}/graph`: Retrieve correlation graph nodes and edges (`GraphResponse`).
  - Edges include relations: `SUPPORTS`, `CONTRADICTS`, `CO_OCCURS`, `DERIVED_FROM`, `NEEDS_REVIEW`.
  - Contradiction edges always provide `alternative_explanation`.
- `GET /api/v1/cases/{case_id}/timeline`: Retrieve chronological provenance and media timeline (`TimelineResponse`).

### 5. Reviewer Audit Trail
- `POST /api/v1/cases/{case_id}/reviews`: Record human reviewer decision (`ReviewCreateRequest` -> `ReviewResponse`).
- `GET /api/v1/cases/{case_id}/reviews`: List reviewer decisions (`ReviewListResponse`).

### 6. Reports
- `POST /api/v1/cases/{case_id}/report`: Generate immutable audit report (`ReportGenerateRequest` -> `ReportResponse`).
- `GET /api/v1/cases/{case_id}/report/download`: Download rendered PDF/JSON report artifact.
