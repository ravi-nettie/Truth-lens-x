# TruthLens X — Multimodal Media Forensics Workbench

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Node: 20+](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![FFmpeg: 6.0+](https://img.shields.io/badge/FFmpeg-6.0%2B-orange.svg)](https://ffmpeg.org/)
[![Architecture: CPU--Only](https://img.shields.io/badge/Architecture-CPU--First%20%C2%B7%20Offline-purple.svg)]()

> **Decision-Support Workbench — Not a Verdict Machine.**  
> TruthLens X is a 100% offline, local-first, multimodal media forensics and verification workbench designed for newsrooms, human rights investigators, OSINT analysts, and fact-checking organizations.

---

## Table of Contents
1. [Core Philosophy & Non-Negotiable Engineering Rules](#core-philosophy--non-negotiable-engineering-rules)
2. [Key Capabilities & Unique Selling Propositions](#key-capabilities--unique-selling-propositions)
3. [Architecture Overview](#architecture-overview)
4. [Prerequisites & System Diagnostics](#prerequisites--system-diagnostics)
5. [Quickstart & Setup](#quickstart--setup)
6. [Docker Deployment](#docker-deployment)
7. [Optional P2 Plug-ins & Model Hooks](#optional-p2-plug-ins--model-hooks)
8. [Demo Scenario](#demo-scenario)
9. [Running the Test Matrix](#running-the-test-matrix)
10. [11-Screen Forensic Workbench](#11-screen-forensic-workbench)
11. [System Assumptions & Known Limitations](#system-assumptions--known-limitations)
12. [Third-Party Licenses & Attributions](#third-party-licenses--attributions)

---

## Core Philosophy & Non-Negotiable Engineering Rules

TruthLens X is built on four immutable forensic engineering principles:

### Rule 1: Local-First & 100% Offline Execution on CPU
- Runs entirely on standard commercial laptops (8–16 GB RAM, CPU-only).
- **Zero external network requests** at runtime: zero paid cloud APIs, zero telemetries, zero external CDN scripts or web fonts.
- All model weights pre-downloaded during initial setup (`scripts/download_models.py`), never dynamically requested on user interaction.

### Rule 2: Forensic Honesty & Calibrated Evidence Tiers
- **Zero Global Fake Probability / Deepfake Percentage**: A single composite score ($P(\text{Fake} \mid \text{Signals})$) is statistically ungrounded, uncalibrated, and dangerous in investigative contexts.
- Findings are categorized into four explicit rule-based strength tiers:
  - `informational`: Standard technical attributes (e.g. video scene cuts, missing EXIF stripped by social media).
  - `weak`: Potential anomalies with common benign explanations (e.g. editor software metadata).
  - `moderate`: Incompatible cross-modal signals or structural duplication (e.g. copy-move clusters, caption number mismatches).
  - `strong`: Cryptographic or indisputable physical contradictions (e.g. identical camera serial asserting conflicting timestamps).
- **Mandatory Alternative Explanations**: Every finding and every `CONTRADICTS` graph relationship provides plain-language alternative explanations and technical limitations.
- **Anti-Suppression Integrity**: When independent methods produce conflicting conclusions, neither is suppressed; both are preserved and marked `NEEDS_REVIEW`.

### Rule 3: Strict Architecture & Storage Boundaries
- Single FastAPI process with a single SQLite database running in Write-Ahead Logging (`WAL`) mode.
- **Immutable Read-Only Evidence Repository**: Original evidence files are strictly stored at `data/evidence/<case_id>/<sha256>.<ext>` with filesystem permission mode `0444` (read-only).
- Analyzers are pure functions: `def analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult`. They never write to SQLite directly and never mutate original media.
- Reports are compiled strictly from database records so the exported document is an exact reproduction of what the human reviewer audited.

### Rule 4: Security, Safety & Subprocess Isolation
- All external media tools (FFmpeg, ffprobe) run through safe subprocess wrappers with `shell=False`, argument lists, timeouts, duration caps, and strict protocol whitelisting (`-nostdin -hide_banner -protocol_whitelist file`).
- Strict upload filtering: rejects executables (`415`), archives (`415`), corrupt payloads (`422`), and oversized files (`413`).
- Persistent top ribbon (`"MOCK DATA ACTIVE — NOT REAL ANALYSIS"`) whenever mock simulation mode is toggled.

---

## Key Capabilities & Unique Selling Propositions

### USP 1: Interactive Cross-Modal Contradiction Graph
- Deterministic correlation engine evaluating rules **R1 through R8** across text claims, video timestamps, audio discontinuities, and image metadata.
- Interactive canvas force-directed graph with color-coded directed relationships:
  - `CONTRADICTS` (Red): Incompatible numerical claims, date/time conflicts, or entity mismatches.
  - `CO_OCCURS` (Amber): Simultaneous audio splices and video scene cuts (Rule R7).
  - `SUPPORTS` (Green): Corroborated entities or matching temporal markers.
  - `DERIVED_FROM` (Blue): Duplicate evidence sharing identical SHA-256 hashes.
  - `NEEDS_REVIEW` (Slate Dashed): Conflicting findings requiring human adjudication.
- **Edge Inspector Panel**: Clicking any edge surfaces rule names, cited observation IDs, forensic explanations, mandatory alternative explanations, and strength tiers.
- **Table Fallback**: Instant toggle between interactive canvas and an accessible, filterable edge table.

### USP 2: Evidence Provenance & Tamper Timeline
- Unified chronological timeline merging file upload events, container creation dates, EXIF timestamps, media-time anomalies, human review decisions, and hash verifications.
- **Header Note**: Explicitly labelled *"Provenance-aware audit trail — not legal chain of custody."*
- **One-Click Hash Re-Verification**: Recomputes SHA-256 hashes for all active evidence on disk, verifies against stored records, updates the cryptographic audit log (`prev_hash -> entry_hash`), and reports verification health.

---

## Architecture Overview

```
                               ┌──────────────────────────────────────────────┐
                               │       TruthLens X Forensic Workbench         │
                               │   (React + Vite + TypeScript + Tailwind)     │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / Local Single-Port (:8000)
                               ┌──────────────────────▼───────────────────────┐
                               │         FastAPI Single Process Engine        │
                               │    (/api/* endpoints + SPA static mount)     │
                               └───────┬──────────────┬──────────────┬────────┘
                                       │              │              │
                     ┌─────────────────▼──┐    ┌──────▼─────┐  ┌─────▼──────────┐
                     │ Immutable Store    │    │ SQLite WAL │  │ Safe Runner    │
                     │ (mode 0444 files)  │    │ (metadata) │  │ (FFmpeg/Probe) │
                     └────────────────────┘    └────────────┘  └────────────────┘
                                       │              │
                   ┌───────────────────┴──────────────┴───────────────────┐
                   │               Pure-Function Analyzers                │
                   │  Image (EXIF, ELA, Quantization, Copy-Move)         │
                   │  Video (Probe, Scene Cuts, PTS Continuity, Frames)   │
                   │  Audio (Waveform, Mel-Spectrogram, Discontinuity)    │
                   │  Text (NLP Claim Extraction, Cross-Modal Compare)    │
                   └───────────────────────────┬──────────────────────────┘
                                               │
                               ┌───────────────▼──────────────┐
                               │  Cross-Modal Rules Engine    │
                               │  (Rules R1 - R8 Correlation) │
                               └───────────────┬──────────────┘
                                               │
                               ┌───────────────▼──────────────┐
                               │ Deterministic Report Engine  │
                               │  - PDF Report (11 Sections)  │
                               │  - Canonical JSON + SHA-256  │
                               └──────────────────────────────┘
```

---

## Prerequisites & System Diagnostics

- **Python**: `>= 3.11` (Tested on Python 3.11 through 3.15)
- **Node.js**: `>= 20.0`
- **FFmpeg & ffprobe**: `>= 6.0` (with x264, aac, and lavfi filters)
- **Memory**: 8 GB RAM minimum (16 GB recommended)
- **Storage**: ~500 MB for core installation + optional models

Run the built-in diagnostic doctor:
```bash
make doctor
# On Windows:
make.bat doctor
```

---

## Quickstart & Setup

### 1. Automated Setup
Installs Python dependencies, sets up offline models, and compiles the React production bundle into `frontend/dist`:
```bash
make setup
# On Windows:
make.bat setup
```

### 2. Launch Local Development Server
Starts the single-port FastAPI server at `http://127.0.0.1:8000` (serving both the API and the React SPA offline):
```bash
make dev
# On Windows:
make.bat dev
```

Visit [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.

---

## Docker Deployment

TruthLens X provides a production-ready, single-port Docker container (`Dockerfile` & `docker-compose.yml`) based on `python:3.11-slim` with system FFmpeg 6+, OpenCV dependencies, and pre-compiled frontend assets:

### Single Command Launch
```bash
# Build and run container in detached mode
docker compose up --build -d

# Check real-time container health
docker compose ps

# View application logs
docker compose logs -f

# Shut down container
docker compose down
```

Or via Makefile:
```bash
make docker-build
make docker-up
make docker-down
```

### Container Architecture & Volumes
- **Single Port (8000)**: Serves both the JSON REST API (`/api/*`) and the high-contrast React SPA from a single container interface.
- **Persistent Volume Mounts**:
  - `./data:/app/data`: Case SQLite database, mode `0444` immutable evidence repository, and generated PDF/JSON forensic reports.
  - `./models:/app/models`: Pre-downloaded offline models directory.
- **Offline Guarantee**: Default environment variables inside the container enforce `ENABLE_OPTIONAL_MODELS=false` and zero external network access.
- **Healthcheck**: Configured with a native Docker healthcheck pinging `GET /api/health` every 30 seconds.

---

## Optional P2 Plug-ins & Model Hooks

All optional and heavy ML models are kept strictly behind the environment toggle:
```ini
ENABLE_OPTIONAL_MODELS=false   # Default: strictly off for deterministic offline P0/P1 runs
```
Enabling this flag activates three P2 stretch plug-in capabilities without breaking any Rule 1, 2, or 3 invariants:

### 1. C2PA Content Credentials Manifest Reader (`backend/app/analyzers/provenance/c2pa_check.py`)
- Automatically utilizes `c2patool` (system binary) or `c2pa-python` if present in the environment; otherwise falls back to a structural container byte scanner for JUMBF / `urn:c2pa` markers.
- Parses embedded digital claims, signing certificates, and edit actions, appending them to the **Evidence Provenance & Tamper Timeline**.
- **Forensic Honesty Guarantee**: The absence of a C2PA manifest is recorded as an `informational` observation explicitly stating: *"The absence of a C2PA manifest proves nothing about media provenance, authenticity, or tampering."* (as standard consumer hardware and social platforms routinely omit or strip manifests).

### 2. Pretrained Detector Plug-in Hook (`backend/app/analyzers/plugins/detector_hook.py`)
- Provides a clean, standardized hook for open-license image/audio classifiers in `models/detectors/`.
- **Invariants Enforced**:
  - If model weights are missing from `models/detectors/`, gracefully logs `status="skipped_missing_model"` with a clear human explanation and allows the pipeline to finish cleanly.
  - When executed, model output is strictly stored in `model_score` with `model_calibrated=False` and the permanent badge `"uncalibrated model output"`.
  - Strictly forbidden from generating global fake probabilities or final authenticity verdicts.

### 3. Local Semantic Similarity & Wording-Only Paraphraser (`backend/app/analyzers/text/semantic.py`)
- **Dense Cosine Similarity**: When `models/all-MiniLM-L6-v2` is present, upgrades caption vs. transcript linguistic comparison from TF-IDF to dense sentence embeddings. Stored strictly as an `informational` metric with the permanent disclaimer: *"Similarity only — not a verdict"*.
- **Wording-Only Paraphraser**: Optional local LLM summarizer designed with strict forensic guardrails:
  - May **ONLY** rephrase and synthesize already-computed, cited database findings.
  - **Strictly forbidden** from creating new observations, claims, or graph edges.
  - Preserves all cited alternative explanations and technical limitations verbatim.

---

## Demo Scenario

TruthLens X includes a reproducible demonstration scenario: **Campus Tech Fest 2026: Attendance & Incident Investigation**.

### Seeding the Demo Case
To generate synthetic fixtures and run the full pipeline:
```bash
make demo
# On Windows:
make.bat demo
```

This seeds:
- **Edited Video** (`campus_fest_edited.mp4`): 14.0s video with an intentional scene cut and audio splice at ~00:07.4 and container creation time rewritten to Saturday 18:30.
- **Clean Control Video** (`campus_fest_control.mp4`): Continuous 6.0s footage with steady audio and pristine container metadata.
- **Edited Image** (`campus_fest_edited.jpg`): Campus photograph with duplicate crowd feature patches (copy-move) and an editor software tag (`Software: Adobe Photoshop 24.0 (Windows)`).
- **Clean Control Image** (`campus_fest_control.jpg`): Unaltered camera photo with authentic Canon EOS 80D EXIF tags.
- **Audio Splice Recording** (`speech_recording.wav`): 14.0s audio with an abrupt phase discontinuity at 7400 ms.
- **Contradictory Caption** (`social_post.txt`): `"Tech Fest, Saturday 6:30 PM — 3,000 attendees, main gate stampede"`.
- **Reference Transcript** (`demo_transcript.json`): `"Friday afternoon, about three hundred people, no incident"`.

Upon running, the correlation engine identifies:
- `[CONTRADICTS] (moderate) R3_number_mismatch`: Caption claims 3,000 attendees while spoken transcript states three hundred people.
- `[CO_OCCURS] (moderate) R7_audio_visual_cut`: Simultaneous visual scene cut and audio phase discontinuity detected at 7.4s.

---

## Running the Test Matrix

### Fast Smoke Tests (< 30 seconds)
Runs all unit tests across schemas, analyzers, safe subprocesses, and correlation rules:
```bash
make test-smoke
# On Windows:
make.bat test-smoke
```

### Full Test Suite & 17-Case Verification Matrix
Executes the full unit suite and runs all 17 Blueprint scenarios:
```bash
make test
# On Windows:
make.bat test
```

### Test Results
Detailed test matrix outputs are recorded in [docs/test_results.md](file:///c:/Users/Admin/.gemini/antigravity/scratch/truthlens-x/docs/test_results.md):
- **Total Scenarios**: 17
- **Passed**: 17
- **Failed**: 0
- **Overall Status**: `ALL TESTS PASSED`

---

## 11-Screen Forensic Workbench

TruthLens X provides 11 specialized investigation screens:

1. **Landing** (`/`): Framing the platform as a decision-support workbench, 5-stage investigation overview, and quick case access.
2. **New Case** (`/cases/new`): Ingestion interface with drag-and-drop multi-file upload (200 MB limit, 5-minute video demo cap), metadata notes, and caption input.
3. **Dashboard** (`/cases/:id`): Polling analysis progress, analyzer status badges, review priority formula calculation, and evidence table with SHA-256 hash checks.
4. **Image Inspection** (`/cases/:id/image`): Full-resolution image viewer with toggleable Error Level Analysis (ELA) heatmap, Copy-Move bounding box SVG overlay, and EXIF/JPEG quantization tables.
5. **Video Inspection** (`/cases/:id/video`): Container metadata inspector, frame gallery sorted by co-flagged indicators with exact PTS timestamps, and scene cut timeline.
6. **Audio Inspection** (`/cases/:id/audio`): Interactive waveform envelope with discontinuity markers, mel-spectrogram viewer, HTML5 audio playback sync, and timestamped transcript.
7. **Text Cross-Examination** (`/cases/:id/text`): Side-by-side Caption vs. Transcript comparison highlighting numeric, temporal, and entity discrepancies, with similarity scores explicitly labelled *"Similarity only — not a verdict"*.
8. **Contradiction Graph [USP 1]** (`/cases/:id/graph`): Interactive cross-modal graph rendering directed relationships (`CONTRADICTS`, `CO_OCCURS`, `SUPPORTS`, `DERIVED_FROM`, `NEEDS_REVIEW`), edge inspector panel, and edge table fallback.
9. **Provenance & Tamper Timeline [USP 2]** (`/cases/:id/timeline`): Chronological audit trail with event filtering chips, custody disclaimer, and one-click evidence hash re-verification.
10. **Forensic Report & Limitations** (`/cases/:id/report`): Human review completeness breakdown, PDF download (11 sections), canonical JSON download, `report_json_sha256` badge, and system limitations guide.
11. **Case History** (`/cases`): Full repository listing with status badges, evidence counts, triage priority, and case deletion with confirmation modal.

---

## System Assumptions & Known Limitations

TruthLens X explicitly documents uncertainty across 5 standardized categories:

1. **Measurement Uncertainty**: Sensor noise, lossy compression artifacts, and downscaling for rapid CPU analysis (images with longest dimension > 2000 px are downscaled).
2. **Model Uncertainty**: Speech recognition (ASR) phonetic confusions, background chatter overlap, and acoustic degradation. All ML models are uncalibrated and flagged as such.
3. **Interpretation Uncertainty**: Ordinary cinematic scene cuts, multi-camera broadcast switching, and innocent social media metadata stripping look identical to deliberate manipulation at container level.
4. **Coverage Uncertainty**: Analysis is restricted to files uploaded by the user; lack of continuous multi-angle capture or original camera RAW containers prevents absolute certainty.
5. **Transcription Uncertainty**: Automated transcripts must be treated as hypotheses to verify by listening; captions often legitimately summarize, round figures, or paraphrase.

---

## Third-Party Licenses & Attributions

TruthLens X relies on open-source libraries and models under permissive licenses:

| Component | Purpose | License |
|---|---|---|
| **FastAPI** | Offline API backend routing | MIT |
| **ReportLab** | Forensic PDF report compilation | BSD-3-Clause |
| **OpenCV (`opencv-python-headless`)** | Video frame extraction & scene cut analysis | Apache 2.0 |
| **Pillow (PIL)** | Image structural validation & ELA processing | HPND |
| **exifread** | Raw EXIF metadata extraction | BSD-3-Clause |
| **spaCy (`en_core_web_sm`)** | Offline entity & temporal expression parsing | MIT |
| **faster-whisper** | Local CPU speech transcription (optional) | MIT |
| **React & Vite** | Investigation workbench frontend | MIT |
| **Tailwind CSS** | Forensic workbench styling | MIT |
| **Lucide React** | High-contrast UI iconography | ISC |

All synthetic demo media fixtures in `samples/` are team-authored and released under **CC0 / Public Domain** (see [samples/LICENSES.md](file:///c:/Users/Admin/.gemini/antigravity/scratch/truthlens-x/samples/LICENSES.md)).
