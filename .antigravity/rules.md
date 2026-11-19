# TruthLens X — Non-Negotiable Engineering Rules

These rules apply to the TruthLens X repository and must be followed in every subsequent prompt:

## 1. Local-First & CPU-Only:
- Everything in P0 and P1 must run 100% offline on CPU (8–16 GB RAM laptops, Python 3.11, Node 20, FFmpeg 6+).
- No paid APIs, no outbound network calls at runtime, no Redis, no Celery, no Postgres, no GPU-only dependencies.
- Model downloads happen only during setup (`scripts/download_models.py`), never on first user request.

## 2. Forensic Honesty & Language Rules:
- Never compute or display a "global fake probability", "deepfake percentage", or invented accuracy metric.
- Never claim "detected a deepfake" or "legal chain of custody". Use "indicator", "evidence strength", "requires human review", and "provenance-aware audit trail".
- Every weak or moderate observation and every CONTRADICTS edge MUST include a plain-language `alternative_explanation` and `limitations`.
- Missing EXIF or ordinary video scene cuts alone are `informational`, never suspicious by themselves.
- Text-only mismatches cap at `moderate` strength.
- Any optional pretrained ML score MUST set `model_calibrated=False` and be labelled "uncalibrated model output" in the UI and report.

## 3. Strict Architecture Boundaries:
- Single FastAPI process, single SQLite DB (WAL mode), one read-only evidence directory (`data/evidence/<case>/<sha256>.<ext>` with mode `0444`), and one derived artifacts directory (`data/artifacts/<case>/...`).
- Analyzers are pure functions: `def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult`. They NEVER touch the database, NEVER modify originals, and NEVER raise unhandled exceptions to the caller (always wrap and return `status="failed"` with a human-readable `error`).
- The correlation engine reads observations, claims, and metadata only—it never opens media files.
- The report engine renders strictly from database rows so the exported PDF/JSON always matches what the reviewer saw.

## 4. Security & Safety:
- All subprocess calls (FFmpeg/ffprobe) must go through `backend/app/services/safe_subprocess.py` with `shell=False`, list arguments, `-nostdin -hide_banner -protocol_whitelist file`, timeouts, and duration caps.
- Validate uploads by allow-listed extension, magic bytes, and size limit; reject archives/executables (`415`), oversized files (`413`), and corrupt files (`422`).
- Never show mock data in the UI without an explicit, visible `MOCK DATA` ribbon.
