# TruthLens X — Automated Batch Evaluation Report

**Run Timestamp:** 2026-11-19T20:43:50.702948+00:00  
**Evaluation Manifest:** `..\samples\evaluation\small_manifest.csv`  
**Total Evaluated Samples:** 28  
**Total Execution Time:** 6.38s  

---

## 1. Executive Summary & Verification Metrics

| Metric | Measured Value | Target Benchmark | Status |
| :--- | :--- | :--- | :--- |
| **Accuracy** | **82.14%** | &ge; 85.0% | FLAG |
| **Precision** | **100.00%** | &ge; 80.0% | PASS |
| **Recall (Sensitivity)** | **58.33%** | &ge; 80.0% | FLAG |
| **F1-Score** | **0.7368** | &ge; 0.80 | FLAG |
| **False Positive Rate (FPR)** | **0.00%** | &le; 15.0% | PASS |
| **Evidence Hash Immutability** | **True** | 100% Unaltered | PASS |

### Binary Confusion Matrix
- **True Positives (TP):** 7 (Correctly flagged manipulations)
- **True Negatives (TN):** 16 (Correctly cleared authentic controls)
- **False Positives (FP):** 0 (Authentic samples incorrectly flagged)
- **False Negatives (FN):** 5 (Manipulations missed by heuristic suite)

---

## 2. System Throughput & Latency Performance

- **Throughput:** **4.39 samples/second**
- **Peak RAM Allocated:** **23.83 MB**
- **GPU Memory:** N/A (CPU-first offline engine)
- **Job Failure Rate:** **0.0%**

### Processing Latency Percentiles (CPU-Only)
- **Mean Latency:** 225.94 ms
- **Median (p50) Latency:** 70.46 ms
- **95th Percentile (p95) Latency:** 753.89 ms
- **Min / Max Latency:** 20.38 ms / 1042.27 ms

---

## 3. Modality Breakdown

| Modality | Samples | Accuracy | Recall | FPR |
| :--- | :--- | :--- | :--- | :--- |
| **IMAGE** | 20 | 85.0% | 62.5% | 0.0% |
| **VIDEO** | 4 | 50.0% | 0.0% | 0.0% |
| **AUDIO** | 4 | 100.0% | 100.0% | 0.0% |

---

## 4. Key Correctness & Forensic Safeguards Verified

1. **Non-JPEG PNG ELA False Positive Suppression:** Verified that lossless PNG images are correctly designated as non-applicable for ELA without generating false-positive splicing flags.
2. **Copy-Move Geometric Support:** Keypoint inlier count, Euclidean centroid distance in pixels, and relative frame diagonal measurements were computed deterministically without memory leakage.
3. **Evidence Hash Immutability:** Pre- and post-analysis SHA-256 verification confirmed that zero evidence files were mutated on disk.
4. **Error Isolation:** Individual sample timeouts or format quirks are completely isolated without interrupting batch execution.

---

## 5. Artifacts & Reproduction Instructions

To reproduce this evaluation benchmark:
```bash
python scripts/evaluate_batch.py --manifest samples/evaluation/small_manifest.csv --output-dir evaluation_reports/small_run
```
All raw predictions and per-sample logs are recorded in:
- `evaluation_results.csv`
- `evaluation_summary.json`
- `failure_report.csv`
- `confusion_matrix.png`
- `latency_distribution.png`
