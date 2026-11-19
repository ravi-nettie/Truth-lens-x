# TruthLens X — Technical & Forensic Judge Q&A

Comprehensive responses to technical, architectural, and ethical questions from evaluators and judges.

---

### Q1: Why not just call GPT-4o, Claude Vision, or a multimodal LLM API to check if an image or video is manipulated?
**Answer**:
1. **Air-Gapped & Confidential Operation**: In investigative journalism and sensitive litigation, uploading unreleased whistleblower media to third-party cloud APIs violates source protection ethics and confidentiality. TruthLens X runs 100% offline.
2. **Hallucination & Non-Reproducibility**: LLMs frequently hallucinate forensic artifacts, are susceptible to prompt injection, and lack deterministic signal processing tools (e.g. STFT frequency decomposition, error level analysis, SIFT keypoint homographies).
3. **Zero Operating Cost**: TruthLens X requires zero API keys, subscriptions, or outbound tokens, running on standard commodity laptops.

---

### Q2: Why refuse to output a simple "92% Deepfake" percentage score?
**Answer**:
A single percentage score is mathematically unsound in digital forensics:
1. It conflates distinct physical phenomena (compression artifacts, multi-camera edits, sensor noise) into an arbitrary number.
2. It suffers from severe out-of-distribution failure on real-world compressed media.
3. Courts and journalistic verification desks reject opaque scores. TruthLens X provides structured, calibrated indicators with explicit alternative explanations and scope limitations, empowering the human analyst rather than replacing them.

---

### Q3: How do you guarantee CPU performance without an expensive GPU?
**Answer**:
1. **Quantized Models**: Speech-to-text uses `faster-whisper` quantized to `int8`, achieving 4–8x real-time transcription speeds on modern x86/ARM CPUs without CUDA.
2. **Targeted Signal Analyzers**: Image and video analyzers use optimized C++ bindings (`opencv-python-headless`, `numpy`, `scenedetect`) which run vectorized SIMD/AVX routines directly on the CPU.
3. **Lazy Frame Extraction**: Video analyzers process keyframes and candidate cuts rather than decoding every raw pixel stream unnecessarily.

---

### Q4: How does TruthLens X prevent common false positives from social media compression?
**Answer**:
1. **Benign Baselines**: Missing EXIF data and ordinary scene cuts are hardcoded as `informational` and cannot trigger suspicion on their own.
2. **Alternative Explanations**: Every weak and moderate signal automatically couples with benign causes (e.g., JPEG recompression grids, sensor Bayer filter artifacts, audio buffer drops).
3. **Correlation Validation**: High suspicion only arises when multiple orthogonal modalities (e.g. video cut + audio phase jump + spoken claim contradiction) converge on the same anomaly.

---

### Q5: What makes the evidence storage tamper-evident?
**Answer**:
1. **Immutable Ingestion**: Files are immediately hashed via SHA-256 upon ingestion and saved to `data/evidence/<case>/<sha256>.<ext>` with filesystem permissions `0444` (read-only).
2. **Audit Trail**: Every analysis run, reviewer judgment, and generated report links back to the original cryptographic hashes.
3. **Database-Driven Consistency**: Reports are rendered directly from SQLite WAL records, ensuring the exported record matches the verified data exactly.
