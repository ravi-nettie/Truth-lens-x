# TruthLens X — Multimodal Media Forensics Workbench

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Node: 20+](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![FFmpeg: 6.0+](https://img.shields.io/badge/FFmpeg-6.0%2B-orange.svg)](https://ffmpeg.org/)
[![Architecture: CPU-First](https://img.shields.io/badge/Architecture-CPU--First%20%C2%B7%20Offline-purple.svg)]()
[![Docker: Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

> **Decision-Support Workbench — Not a Verdict Machine.**  
> TruthLens X is a 100% offline, local-first multimodal digital media forensics and verification workbench designed for newsrooms, human rights investigators, OSINT analysts, and fact-checking organizations.
>
> 🌐 **Live Frontend Demo**: [https://ravi-nettie.github.io/Truth-lens-x/](https://ravi-nettie.github.io/Truth-lens-x/)

---

## Table of Contents
1. [Overview & Problem Statement](#overview--problem-statement)
2. [Core Philosophy & Forensic Safeguards](#core-philosophy--forensic-safeguards)
3. [Key Features & Capabilities](#key-features--capabilities)
4. [Technology Stack](#technology-stack)
5. [System Architecture](#system-architecture)
6. [Interactive User Interface (Google Stitch System)](#interactive-user-interface-google-stitch-system)
7. [Installation & Prerequisites](#installation--prerequisites)
8. [Local Execution Commands](#local-execution-commands)
9. [Docker & Containerized Deployment](#docker--containerized-deployment)
10. [Dataset & Model Requirements](#dataset--model-requirements)
11. [API Documentation](#api-documentation)
12. [Evaluation Benchmark & Performance](#evaluation-benchmark--performance)
13. [Known Forensic Limitations & Boundaries](#known-forensic-limitations--boundaries)
14. [Hackathon Submission & Provenance](#hackathon-submission--provenance)
15. [Licenses & Attributions](#licenses--attributions)

---

## Overview & Problem Statement

### The Problem
Modern digital media is increasingly vulnerable to sophisticated manipulation, context recycling, and synthetic generation. Investigators, journalists, and forensic analysts face critical hurdles:
1. **Black-Box "Deepfake Detectors"**: Most commercial tools output arbitrary composite percentages (e.g. *"94% Fake"*). These single scores are mathematically ungrounded, uncalibrated across camera sensors, and useless in courtrooms or editorial rooms because they lack cited evidence.
2. **Cloud Privacy Leaks**: Uploading sensitive leaks, conflict footage, or whistleblower recordings to third-party cloud APIs violates source protection and exposes confidential media to third-party data collection.
3. **Modal Isolation**: Existing tools analyze images, audio, or video in silos. Splicing often occurs across modalities—such as re-dubbing authentic video with contradictory audio, or pairing clean imagery with fabricated timestamps and attendance numbers.
4. **False-Positive Traps**: Conventional Error Level Analysis (ELA) algorithms routinely flag lossless PNG files or social media recompressions as "manipulated," generating hundreds of false alarms.

### The TruthLens X Solution
TruthLens X operates strictly as an **evidence-based decision-support workbench**. It never issues a binary "fake or real" verdict. Instead, it computes deterministic mathematical indicators across image, video, audio, and text, projects them onto an interactive **Cross-Modal Contradiction Graph**, tracks evidence provenance along an audit timeline, and generates cryptographically signed, peer-reviewable forensic PDF and JSON reports.

---

## Core Philosophy & Forensic Safeguards

TruthLens X enforces four non-negotiable engineering principles:

### Rule 1: Local-First & 100% Offline Execution on CPU
- Operates entirely on standard commercial laptops (8–16 GB RAM, CPU-only).
- **Zero external network calls** at runtime: zero cloud dependencies, zero external telemetry, zero web fonts, and zero tracking pixels.
- All model weights are pinned and pre-downloaded offline during setup (`scripts/download_models.py`).

### Rule 2: Forensic Honesty & Calibrated Evidence Tiers
- **Zero Global Fake Probability**: Rejects unscientific composite probability scores.
- Findings are mapped into four explicit, calibrated evidence tiers:
  - `informational`: Baseline container metadata, video scene cuts, or standard social media EXIF stripping.
  - `weak`: Minor anomalies with benign everyday explanations (e.g., standard photo editing software signatures).
  - `moderate`: Incompatible cross-modal claims or structural repetition (e.g., copy-move keypoint clusters, caption number conflicts).
  - `strong`: Cryptographic contradictions or physically impossible discrepancies (e.g., camera serial number timestamp collisions).
- **Mandatory Alternative Explanations**: Every finding and every graph edge provides plain-language alternative hypotheses (e.g. why compression artifacts may mimic copy-move features).
- **Anti-Suppression Integrity**: When independent methods produce conflicting conclusions, neither is suppressed; both are preserved and marked `NEEDS_REVIEW`.

### Rule 3: Strict Architecture & Storage Boundaries
- Single FastAPI process with a single SQLite database running in Write-Ahead Logging (`WAL`) mode.
- **Immutable Evidence Repository**: Original evidence is saved at `data/evidence/<case_id>/<sha256>.<ext>` with filesystem permissions set to mode `0444` (read-only).
- Analyzers are pure functions: `analyze(evidence: dict, ctx: AnalysisContext) -> AnalyzerResult`. Analyzers never mutate original media or write to SQLite directly.

### Rule 4: Security, Safety & Subprocess Isolation
- External binaries (FFmpeg, ffprobe) run through isolated subprocess wrappers with `shell=False`, strict argument arrays, hard execution timeouts, duration caps, and protocol whitelisting (`-nostdin -hide_banner -protocol_whitelist file`).
- Strict MIME-type validation rejects executable binaries (`415`), archive bombs (`415`), and oversized payloads (`413`).

---

## Key Features & Capabilities

### 1. Interactive Cross-Modal Contradiction Graph
- Evaluates correlation rules (**R1 through R8**) across text claims, video timestamps, audio discontinuities, and image metadata.
- Interactive force-directed canvas displaying color-coded directed relationships:
  - `CONTRADICTS` (Red): Incompatible numerical claims, date/time conflicts, or entity mismatches.
  - `CO_OCCURS` (Amber): Simultaneous audio splices and video scene cuts (Rule R7).
  - `SUPPORTS` (Green): Corroborated entities or matching temporal markers.
  - `DERIVED_FROM` (Blue): Duplicate evidence sharing identical SHA-256 hashes.
  - `NEEDS_REVIEW` (Slate Dashed): Conflicting findings requiring human adjudication.
- **Edge Inspector Panel**: Clicking any edge surfaces rule names, cited observation IDs, forensic explanations, mandatory alternative explanations, and strength tiers.
- **Table Fallback**: Instant toggle between interactive canvas and an accessible, filterable edge table.

### 2. Evidence Provenance & Tamper Timeline
- Unified chronological timeline merging file upload events, container creation dates, EXIF timestamps, media-time anomalies, human review decisions, and hash verifications.
- **Header Note**: Explicitly labelled *"Provenance-aware audit trail — not legal chain of custody."*
- **One-Click Hash Re-Verification**: Recomputes SHA-256 hashes for all active evidence on disk, verifies against stored records, updates the cryptographic audit log (`prev_hash -> entry_hash`), and reports verification health.

### 3. Multimodal Forensic Analysis Engines
- **Image Forensics**:
  - Format-aware Error Level Analysis (ELA) with lossless PNG false-positive suppression.
  - JPEG Quantization Table Analysis (DQT matrix recovery and quality factor derivation).
  - Copy-Move Duplication Detection (ORB keypoints + RANSAC homography, cluster Euclidean distance, and spatial bounding boxes).
  - EXIF Metadata Inspection (Software tag detection, camera serial, GPS, temporal divergence).
  - Dedicated AI-Origin Image Classifier (`Organika/sdxl-detector` on CPU, strictly separated from heuristic modules).
- **Video Forensics**:
  - Container Stream Probing (FPS, codec profile, duration mismatch).
  - HSV Histogram Correlation Scene-Cut Detection with millisecond boundary tracking.
  - Frame Presentation Timestamp (PTS) continuity and variable frame rate (VFR) inspection.
  - I-frame / P-frame / B-frame visual gallery extraction.
- **Audio Forensics**:
  - Native 16 kHz mono waveform parsing and Mel-spectrogram rendering.
  - Spectral flux discontinuity analysis and background noise-floor envelope shifts.
  - Digital silence run and peak sample clipping detection.
  - Offline ASR Speech-to-Text via `faster-whisper` (`tiny.en` int8).
- **Cross-Modal Text & Entity Verification**:
  - Offline rule-based NLP claim parser extracting dates, times, entity names, and quantities.
  - Cross-modal numerical discrepancy detection (comparing caption claims against spoken transcript numbers).
  - Temporal conflict detection (comparing EXIF timestamps against spoken dates).
  - TF-IDF and optional cosine semantic similarity (`all-MiniLM-L6-v2`).

### 4. Deterministic Report Generation
- **Canonical JSON Report**: Complete structured forensic case file with an SHA-256 digest covering all normalized fields.
- **Courtroom/Newsroom-Ready PDF Report**: 11-section layout formatted with ReportLab:
  - Executive Case Summary & Methodology Disclaimer.
  - Analyzer Coverage Matrix (executed, skipped, failed).
  - AI-Origin Classifier Provenance Box (with calibration status).
  - Visual Copy-Move Match Overlays with supporting spatial measurements.
  - Cross-Modal Contradiction Graph Excerpt.
  - Chronological Provenance Timeline.
  - Human Adjudication Audit Log (System Log Integrity Only).
  - SHA-256 Digital Fingerprint.

---

## Technology Stack

| Layer | Component | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend** | Python | 3.11+ (Tested to 3.15) | Core execution runtime |
| **API Framework** | FastAPI + Uvicorn | 0.115+ | High-throughput async REST API & single-port SPA serving |
| **Database** | SQLite 3 (WAL Mode) | System / Python stdlib | Local ACID metadata store and audit log chaining |
| **Image Analysis** | Pillow + NumPy + OpenCV | 11.0+ / 2.0+ / 4.10+ | Format-aware ELA, DQT parsing, ORB copy-move |
| **Video/Audio Media** | FFmpeg & ffprobe | 6.0+ | Subprocess-isolated container extraction and stream probing |
| **Audio Processing** | SciPy + faster-whisper | 1.14+ / 1.1+ | Mel-spectrograms, spectral flux, offline speech-to-text |
| **NLP & Text** | scikit-learn + Pure Python Regex | 1.5+ | Number/time extraction, TF-IDF cosine similarity |
| **Report Generation** | ReportLab | 4.2+ | Deterministic multi-page PDF generation |
| **Frontend Framework** | React + TypeScript | 18.3+ / 5.5+ | Type-safe single-page reactive application |
| **Frontend Build** | Vite | 5.4+ | Hot module replacement & production bundling |
| **Design System** | Tailwind CSS + Google Stitch | 3.4+ | Consistent forensic dark-mode styling |
| **Containerization** | Docker + Docker Compose | 24.0+ / 3.8 | Single-port production packaging |

---

## System Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │           TruthLens X Frontend Workbench               │
                               │        (React 18 + TypeScript + Google Stitch UI)      │
                               └───────────────────────────┬────────────────────────────┘
                                                           │ HTTP / Single-Port (:8000)
                               ┌───────────────────────────▼────────────────────────────┐
                               │             FastAPI Unified Application                │
                               │         (/api/* endpoints + Static SPA Mount)          │
                               └───────────┬───────────────┬────────────────┬───────────┘
                                           │               │                │
                         ┌─────────────────▼──┐     ┌──────▼─────┐   ┌──────▼───────────┐
                         │ Immutable Store    │     │ SQLite WAL │   │ Subprocess Guard │
                         │ (mode 0444 files)  │     │ (metadata) │   │ (FFmpeg/ffprobe) │
                         └────────────────────┘     └────────────┘   └──────────────────┘
                                           │               │
                       ┌───────────────────┴───────────────┴────────────────────┐
                       │                Pure-Function Analyzers                 │
                       │  Image: EXIF · Quantization · ELA · Copy-Move · AI     │
                       │  Video: Probe · HSV Scene Cut · PTS Timeline · Frames  │
                       │  Audio: Waveform · Spectrogram · Flux · Speech-to-Text │
                       │  Text: Claims · Entities · Numbers · Cross-Modal Comp  │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                   ┌───────────────▼──────────────┐
                                   │   Cross-Modal Correlation    │
                                   │  Deterministic Rules R1 - R8 │
                                   └───────────────┬──────────────┘
                                                   │
                                   ┌───────────────▼──────────────┐
                                   │     Deterministic Reports    │
                                   │  - 11-Section Forensic PDF   │
                                   │  - Canonical Signed JSON     │
                                   └──────────────────────────────┘
```

---

## Interactive User Interface (Google Stitch System)

TruthLens X features a modern, accessible interface inspired by the Google Stitch forensic design system:

| View | Purpose | Screenshot / Reference |
| :--- | :--- | :--- |
| **Landing & Ingestion** | Drag-and-drop multimodal evidence intake, case initialization, and privacy badges. | [View UI Export](stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/truthlens_x_new_investigation/screen.png) |
| **Case Dashboard** | Unified overview of active evidence, analyzer progress, and modality breakdown. | [View UI Export](stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/truthlens_x_investigations/screen.png) |
| **Contradiction Graph** | Interactive canvas displaying cross-modal relationships (`CONTRADICTS`, `CO_OCCURS`, `SUPPORTS`). | [View UI Export](stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/truthlens_x_case_correlation/screen.png) |
| **Provenance Timeline** | Chronological timeline tracking metadata timestamps, media anomalies, and SHA-256 verifications. | [View UI Export](stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/truthlens_x_case_timeline/screen.png) |
| **Forensic Report** | Audit summary, human review confirmations, and one-click PDF / JSON exports. | [View UI Export](stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/stitch_truthlens_x_forensics_ui/truthlens_x_forensic_report/screen.png) |

---

## Installation & Prerequisites

### Prerequisites
- **Python**: `3.11` or higher.
- **Node.js**: `20.0` or higher.
- **FFmpeg & ffprobe**: `6.0` or higher (available in system `PATH`).
- **RAM**: 8 GB minimum (16 GB recommended).
- **Disk**: ~500 MB for core installation.

### System Diagnostic Doctor
Run the built-in diagnostic doctor to verify system dependencies and environment health:
```bash
python scripts/doctor.py
# Or using Make:
make doctor
# On Windows:
make.bat doctor
```

### Installation Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/ravi-nettie/Truth-lens-x.git
   cd Truth-lens-x
   ```

2. **Set up Python Virtual Environment:**
   ```bash
   python -m venv .venv
   # Linux/macOS:
   source .venv/bin/activate
   # Windows:
   .venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Build Frontend Production Bundle:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

5. **Download Local CPU Models (Offline Pre-cache):**
   ```bash
   python scripts/download_models.py
   ```

---

## Local Execution Commands

### 1. Launch Single-Port Production Application
Serves both the backend API and the compiled React SPA on port `8000`:
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
- **Access Application**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 2. Launch Dual-Port Development Server (Hot-Reloading)
For active frontend development:
- **Terminal 1 (Backend)**:
  ```bash
  python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Terminal 2 (Frontend Dev Server)**:
  ```bash
  cd frontend
  npm run dev
  ```
- **Access Dev Server**: [http://localhost:3000](http://localhost:3000)

### 3. Windows One-Click Batch Launchers
For immediate execution on Windows without manual terminal configuration:
- [start_truthlens.bat](start_truthlens.bat): Launches backend (:8000) and frontend (:3000) simultaneously in separate console windows.
- [start_backend.bat](start_backend.bat): Launches the FastAPI backend.
- [start_frontend.bat](start_frontend.bat): Launches the Vite frontend development server.

---

## Docker & Containerized Deployment

TruthLens X is fully containerized as a single-port, production-ready image:

```bash
# Build and run with Docker Compose
docker compose up -d --build

# Inspect status
docker compose ps

# View live logs
docker compose logs -f

# Stop container
docker compose down
```

### Volume Persistence
Docker mounts `./data` and `./models` to the container's `/app/data` and `/app/models`, ensuring all uploaded cases, analysis records, and downloaded weights persist across container restarts.

### One-Click Cloud Deployment (Full Stack: Backend + Frontend + FFmpeg)

TruthLens X includes ready-to-use configuration files for instant cloud hosting:

#### Option 1: Render (Recommended — Free Web Service)
1. Fork or push to your GitHub account (`https://github.com/ravi-nettie/Truth-lens-x`).
2. Log into [Render.com](https://render.com) and click **New > Blueprint**.
3. Connect your repository. Render will automatically detect [render.yaml](render.yaml) and deploy the complete Docker container (FastAPI backend + FFmpeg + built React frontend) as a single web service.

#### Option 2: Railway
1. Log into [Railway.app](https://railway.app) and create a **New Project > Deploy from GitHub repo**.
2. Select `Truth-lens-x`. Railway detects [railway.json](railway.json) and [Dockerfile](Dockerfile) and automatically spins up the instance.

#### Option 3: Fly.io
```bash
fly launch --config fly.toml
fly deploy
```

#### Option 4: GitHub Pages (Static Interactive Demo)
Automated on every push via `.github/workflows/deploy-pages.yml`:
[https://ravi-nettie.github.io/Truth-lens-x/](https://ravi-nettie.github.io/Truth-lens-x/)

---

## Dataset & Model Requirements

Details regarding dataset profiles, provenance, and ground-truth isolation are fully documented in [docs/datasets.md](docs/datasets.md).

### Evaluation Profiles
- **SMALL Profile (28 samples)**: 20 images, 4 videos, 4 audio files. Generatable locally via `python scripts/generate_eval_dataset.py`.
- **MEDIUM Profile (240 samples)**: 200 images, 20 videos, 20 audio files for extended statistical validation.
- **LARGE Profile (2,200 samples)**: 2,000 images, 100 videos, 100 audio files for stress testing and throughput benchmarking.

### Model Weights
- **Speech-to-Text**: `faster-whisper` (`tiny.en` quantized to int8, ~75 MB).
- **AI-Origin Image Classifier**: `Organika/sdxl-detector` (~350 MB safetensors weights).
- **Text Semantic Similarity (Optional)**: `sentence-transformers/all-MiniLM-L6-v2` (~90 MB).
- All weights are stored in `models/` and execute 100% offline on CPU.

---

## API Documentation

All core endpoints are exposed under `/api` with OpenAPI specifications available at `http://127.0.0.1:8000/docs`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck verifying offline execution, CPU mode, and SQLite WAL status. |
| `POST` | `/api/cases` | Create a new forensic investigation case. |
| `GET` | `/api/cases` | List all investigation cases. |
| `GET` | `/api/cases/{id}` | Retrieve case details, evidence list, and analysis status. |
| `POST` | `/api/cases/{id}/evidence` | Upload and ingest an image, video, audio, or text evidence file. |
| `POST` | `/api/cases/{id}/analyze` | Trigger asynchronous pure-function multimodal analyzer pipeline. |
| `GET` | `/api/cases/{id}/observations` | Retrieve all computed forensic observations and strength tiers. |
| `GET` | `/api/cases/{id}/graph` | Compute and return the cross-modal correlation graph (nodes, edges, rules). |
| `GET` | `/api/cases/{id}/timeline` | Retrieve the chronological evidence provenance timeline. |
| `POST` | `/api/cases/{id}/verify-hashes` | Recompute disk SHA-256 hashes and verify immutability. |
| `POST` | `/api/observations/{id}/review` | Record human investigator adjudication (confirm, dismiss, note). |
| `GET` | `/api/cases/{id}/report` | Retrieve canonical JSON forensic report. |
| `GET` | `/api/cases/{id}/report.pdf` | Download court/newsroom-ready PDF forensic report. |

---

## Evaluation Benchmark & Performance

The automated batch evaluation suite ([scripts/evaluate_batch.py](scripts/evaluate_batch.py)) was executed against the SMALL benchmark suite:

```bash
python scripts/evaluate_batch.py --manifest samples/evaluation/small_manifest.csv --output-dir evaluation_reports/small_smoke_test
```

### Measured Performance Summary (CPU-Only)
- **Total Samples Evaluated**: 28
- **Classification Accuracy**: **82.14%**
- **Precision**: **100.00%** (Zero False Positives: `FPR = 0.0%`)
- **Recall (Sensitivity)**: **58.33%**
- **Job Failure Rate**: **0.0%** (Zero crashes or unhandled exceptions)
- **Evidence Hash Immutability**: **100% Verified**
- **Throughput**: **4.39 samples/second**
- **Peak RAM Allocated**: **23.83 MB**
- **Mean Processing Latency**: **225.94 ms** (Median: 70.46 ms, p95: 753.89 ms)

### Generated Evaluation Artifacts
- Binary Confusion Matrix: [evaluation_reports/small_smoke_test/confusion_matrix.png](evaluation_reports/small_smoke_test/confusion_matrix.png)
- Latency Distribution: [evaluation_reports/small_smoke_test/latency_distribution.png](evaluation_reports/small_smoke_test/latency_distribution.png)
- Full Evaluation Summary: [evaluation_reports/small_smoke_test/evaluation_summary.json](evaluation_reports/small_smoke_test/evaluation_summary.json)
- Detailed Markdown Audit: [evaluation_reports/small_smoke_test/evaluation_report.md](evaluation_reports/small_smoke_test/evaluation_report.md)

---

## Known Forensic Limitations & Boundaries

1. **Non-JPEG Originals**: Error Level Analysis (ELA) operates strictly on DCT compression differences. Lossless formats (PNG, TIFF, WebP lossless) naturally show high DCT residuals when saved to JPEG; TruthLens X explicitly suppresses ELA on lossless inputs to avoid false alarms.
2. **Social Media Metadata Stripping**: Platforms like X, WhatsApp, Instagram, and Facebook strip EXIF and C2PA containers upon upload. The absence of metadata or C2PA credentials is an expected attribute and does not prove tampering.
3. **Double Compression Heuristics**: Re-saving a JPEG at an altered quality factor produces quantization anomalies that can resemble splicing; findings are marked `weak` or `informational` and require corroboration.
4. **Copy-Move Repetition**: Highly repetitive textures (e.g., foliage, crowd scenes, brick walls) may yield high ORB keypoint matches. TruthLens X computes Euclidean distance thresholds and RANSAC inlier ratios to mitigate texture false positives.
5. **Decoupled AI Classification**: The AI-Origin detector operates as an auxiliary signal with uncalibrated probabilities (`model_calibrated=False`) and is never combined into a single score with heuristic modules.

---

## Hackathon Information

- **Project**: TruthLens X
- **Track**: Digital Media Forensics & Information Integrity
- **Author / Maintainer**: [@ravi-nettie](https://github.com/ravi-nettie)
- **Repository**: [https://github.com/ravi-nettie/Truth-lens-x](https://github.com/ravi-nettie/Truth-lens-x)
- **Architecture Mandate**: 100% Offline, Local-First, CPU-Only Execution. Zero paid API keys required.
- **Verification Guarantee**: Reproducible with a single command via `make demo` or `make test`.

---

## Licenses & Attributions

- **Codebase License**: [MIT License](LICENSE)
- **Synthetic Sample Fixtures**: Released under Creative Commons Attribution 4.0 International ([samples/LICENSES.md](samples/LICENSES.md)).
- **Third-Party Libraries**: FFmpeg (LGPL/GPL), OpenCV (Apache 2.0), ReportLab (BSD), FastAPI (MIT), Vite/React (MIT), faster-whisper (MIT).
