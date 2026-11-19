# TruthLens X — Live Demo Script & Walkthrough

This script provides a 5-minute guided demonstration of TruthLens X using the pre-seeded "Campus Tech Fest" fixture scenario.

---

## Scenario Background: "Campus Tech Fest 2026"
A viral social media post claims:
> *"Record turnout: 3,000 attendees gathered at Main Plaza for Tech Fest 2026!"*

Accompanying the claim are:
1. `campus_fest_quad.mp4`: A 15-second video recording of the main stage speaker and quad.
2. `crowd_poster.jpg`: A high-resolution photo showing a crowded plaza.
3. `speech_recording.wav`: Clear audio recording of the opening address.

---

## 5-Minute Demonstration Flow

### Step 1: Doctor Check & Offline Verification (30s)
1. Run `make doctor` or `python scripts/doctor.py`.
2. Demonstrate that TruthLens X runs completely offline without paid external APIs or cloud dependencies.

### Step 2: Seed Demo Data (30s)
1. Run `make demo` (or `python scripts/seed_demo.py`).
2. Point out that evidence is immediately hashed (`SHA-256`) and placed in read-only storage (`mode 0444`).

### Step 3: Inspect Ingested Evidence (1 min)
1. Open the Case Dashboard for `Campus Tech Fest Attendance Verification`.
2. Review the 4 evidence items:
   - Video container duration: 15.2s, 1080p @ 30fps.
   - Image EXIF: Canon EOS R6 capture at 14:32:00.
   - Audio: 44.1 kHz WAV master.
   - Text Caption: Extracted claim of "3,000 attendees".

### Step 4: Examine Forensic Indicators & Language (1 min)
1. Navigate to the **Observations Tab**:
   - `audio_discontinuity` at 7400 ms: Highlight the plain-language alternative explanation (*"microphone bump or wireless drop"*).
   - `video_scene_cut` at 7400 ms: Point out that it is categorized as `informational`, not suspicious.
   - `copy_move`: Inspect the SIFT keypoint overlay in the upper-right audience sector with the transparent `uncalibrated model output` badge.

### Step 5: Explore Correlation Graph & Timeline (1 min)
1. Open the **Correlation Graph**:
   - `R7_audio_visual_cut` (CO_OCCURS): Shows that the audio discontinuity exactly matches the camera angle cut at 7400 ms, indicating a standard video edit rather than an intentional speech deletion.
   - `R3_number_mismatch` (CONTRADICTS): Shows the contradiction between the social caption ("3,000 attendees") and the speaker's spoken words ("about three hundred").
2. Open the **Timeline View**: Walk through the chronologically sorted provenance events from capture, upload, media-time marks, to review.

### Step 6: Human Review Decision & Immutable Report (1 min)
1. Submit an analyst review verdict:
   - Target: `R3_number_mismatch`
   - Decision: `confirmed`
   - Notes: *"Discrepancy confirmed: caption exaggerates attendance tenfold compared to speaker speech."*
2. Generate and download the forensic audit report (JSON/PDF).
3. Verify that the report mirrors the database records with a tamper-resistant provenance audit trail.
