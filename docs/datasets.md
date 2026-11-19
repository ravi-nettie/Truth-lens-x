# TruthLens X — Forensic Dataset Registry & Test Profiles

**Version:** 1.0.0  
**License:** CC-BY-4.0 / MIT (Team Synthetic & Public Domain Controls)  
**Storage Directory:** `samples/evaluation/`

---

## 1. Test Profiles Overview

TruthLens X evaluation framework establishes three structured evaluation tiers:

| Profile | Images | Videos | Audio Files | Total Samples | Execution Target | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SMALL** | 20 | 4 | 4 | 28 | Smoke testing (~15s) | Automated CI/CD, regression verification |
| **MEDIUM** | 200 | 20 | 20 | 240 | Targeted benchmark (~3 min) | Comprehensive indicator evaluation |
| **LARGE** | 2,000 | 100 | 100 | 2,200 | Full stress benchmark (~30 min) | Concurrency & endurance testing |

> [!IMPORTANT]
> Large benchmark datasets are **never** downloaded automatically at runtime. Resource availability, storage capacity (>15 GB for Large), and investigator approval are strictly required prior to initiating large-scale tests.

---

## 2. Dataset Sources & Licensing

1. **TruthLens Synthetic Controls & Manipulated Suite (`TruthLens-Synthetic`)**
   - **Provenance:** Procedurally generated ground-truth fixtures created by `scripts/generate_eval_dataset.py`.
   - **License:** MIT / CC0 (Team Owned).
   - **Label Distribution:** 50% Authentic Controls, 50% Ground-Truth Manipulations (Copy-Move, ELA format controls, double quantization, audio frequency phase splices, video temporal scene cuts).
   - **Split:** 100% Test split.

2. **Standard Reference Research Datasets (Medium/Large Reference Pools)**
   - **CASIA v2.0 / CoMoFoD:** Standard image splicing and copy-move reference datasets (Academic research use).
   - **In-The-Wild Video Forensics (FaceForensics++ / DFDC control subsets):** Video temporal cuts and splice sequences.
   - **ASVspoof 2021 / In-The-Wild Audio:** Speech synthesis and audio splice verification.

---

## 3. Ground Truth Isolation Guarantee

- Ground-truth labels (`ground_truth` column in manifests) are **strictly isolated** from forensic analyzer pipelines.
- Analyzers execute as pure black-box forensic decision-support functions (`analyze(evidence, ctx) -> AnalyzerResult`).
- Metrics (confusion matrices, accuracy, precision, recall, F1, FPR) are calculated post-hoc by the evaluation runner comparing recorded findings against manifest labels.

---

## 4. Manifest Schema

Every manifest adheres to the standard CSV structure:
```csv
sample_id,file_path,ground_truth,media_type,source_dataset,split,investigation_id
```
- `sample_id`: Unique identifier for the sample.
- `file_path`: Path relative to repository root.
- `ground_truth`: `authentic` or `manipulated` (or manipulation category).
- `media_type`: `image`, `video`, or `audio`.
- `source_dataset`: Dataset provenance name.
- `split`: `train`, `val`, or `test`.
- `investigation_id`: Case grouping identifier (for multi-file investigation cases).
