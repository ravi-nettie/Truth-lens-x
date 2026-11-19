# TruthLens X — System Architecture

TruthLens X is an offline, CPU-first, multimodal forensic analysis platform designed for newsrooms, verification labs, and fact-checking organizations.

## High-Level Architecture Overview

```
+-------------------------------------------------------------------------+
|                        Frontend (React / Vite)                         |
|  - Evidence Uploader & Inspector   - Provenance Timeline View           |
|  - Graph Visualization             - Reviewer Audit & Report Generator  |
+------------------------------------+------------------------------------+
                                     | HTTP REST API
+------------------------------------v------------------------------------+
|                         FastAPI Backend Process                         |
|                                                                         |
|  [ Routers ] -----------------> [ Services ]                            |
|    /api/v1/cases                  - Safe Subprocess (FFmpeg/ffprobe)    |
|    /api/v1/evidence               - Ingestion & Storage Validation      |
|    /api/v1/analysis               - Database Operations (SQLite WAL)    |
|    /api/v1/reviews                                                      |
|    /api/v1/reports                                                      |
|                                                                         |
|  [ Analyzers (Pure Functions) ]                                         |
|    def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult  |
|    - Image: EXIF, SIFT Copy-Move, Resampling, Noise Inconsistency       |
|    - Video: Scene Cut HSV, Frame Rates, Visual Discontinuities          |
|    - Audio: Spectral Flux, Silence Cuts, Faster-Whisper (int8 CPU)      |
|    - Text: Claim Extraction (Numbers, Dates, Entities), Cross-Check     |
|                                                                         |
|  [ Correlation Engine ]                                                 |
|    - Reads observations, claims, and metadata ONLY                      |
|    - Graph construction (SUPPORTS, CONTRADICTS, CO_OCCURS)              |
|                                                                         |
|  [ Report Generator ]                                                   |
|    - Queries database rows ONLY to generate PDF/JSON exports            |
+------------------------------------+------------------------------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
+----------v-----------+                             +---------v----------+
|  SQLite Database     |                             | Local Filesystem   |
|  - WAL mode enabled  |                             | - data/evidence/   |
|  - Foreign keys ON   |                             |   (0444 Read-Only) |
|  - Audit trail       |                             | - data/artifacts/  |
|                      |                             | - models/ (Offline)|
+----------------------+                             +--------------------+
```

## Architectural Principles & Strict Boundaries

### 1. Pure Function Analyzers
Analyzers adhere to the signature:
```python
def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult:
    ...
```
- **No DB Access**: Analyzers never connect to or query SQLite.
- **No File Mutation**: Original media files are mounted read-only (`mode 0444`). Derived images, spectrograms, or JSON data are written strictly to `ctx.artifact_dir`.
- **Fault Tolerance**: Analyzers catch internal errors and return `AnalyzerResult(status="failed", error="...")`, never raising unhandled exceptions to the pipeline coordinator.

### 2. Correlation Engine Isolation
- The correlation engine receives lists of `Observation` and `Claim` records along with technical metadata.
- It operates completely independently of raw media formats, allowing lightweight graph synthesis in milliseconds on standard laptop CPUs.

### 3. Report Engine Determinism
- The PDF and JSON reporting engine queries committed database rows only.
- Reviewer verdicts, human justifications, and analyzed signals in exported reports are 100% identical to what appeared on screen during review.

### 4. Storage Architecture
- **Evidence Storage**: `data/evidence/<case_id>/<sha256>.<ext>` with file mode `0444` (read-only).
- **Artifact Storage**: `data/artifacts/<case_id>/<evidence_id>/<artifact_id>.<ext>`.
- **Database**: Single SQLite file at `data/truthlens.db` configured with `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`.
