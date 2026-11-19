# Sample Media Licensing & Provenance

All media files contained in `samples/` and used across TruthLens X test fixtures are 100% original, self-contained, team-owned synthetic/simulated test fixtures created specifically for reproducible forensic benchmarking and offline demonstrations.

## Included Test Samples

1. **Edited Image (`samples/campus_fest_edited.jpg` & `samples/crowd_poster.jpg`)**:
   - Synthesized campus grounds photograph created via Python Pillow.
   - Contains an intentional cloned feature patch (copy-move artifact) and standard editor metadata tag (`Software: Adobe Photoshop 24.0 (Windows)`).
   - License: CC0 / Public Domain (Team-created).

2. **Clean Control Image (`samples/campus_fest_control.jpg`)**:
   - Clean, untouched synthetic campus grounds image.
   - Preserves standard camera EXIF metadata (`Canon EOS 80D`, `Canon Digital Photo Professional 4.15`) without tampering or copy-move artifacts.
   - License: CC0 / Public Domain (Team-created).

3. **Edited Video (`samples/campus_fest_edited.mp4` & `samples/campus_fest_quad.mp4`)**:
   - 14.0-second simulated MP4 container generated with local FFmpeg test generators.
   - Features a hard scene cut and audio phase splice at ~00:07.4 (7400 ms) and a modified container `creation_time` timestamp (`2026-11-21T18:30:00Z`).
   - License: CC0 / Public Domain (Team-created).

4. **Clean Control Video (`samples/campus_fest_control.mp4`)**:
   - 6.0-second continuous MP4 container generated with local FFmpeg without scene cuts, audio splices, or metadata anomalies.
   - License: CC0 / Public Domain (Team-created).

5. **Audio Discontinuity / Speech Fixture (`samples/speech_recording.wav`)**:
   - 14.0-second single-channel WAV file synthesized with an intentional spectral discontinuity / frequency shift (440 Hz to 880 Hz with phase inversion) at 7400 ms.
   - License: CC0 / Public Domain (Team-created).

6. **Social Post Caption (`samples/social_post.txt`)**:
   - Contradictory text claim: `"Tech Fest, Saturday 6:30 PM — 3,000 attendees, main gate stampede"`.
   - License: CC0 / Public Domain (Team-created).

7. **Precomputed Reference Transcript (`samples/demo_transcript.json` & `samples/demo_transcript.txt`)**:
   - Clearly labelled `"precomputed from the same file"` for deterministic offline demo fallback: `"Friday afternoon, about three hundred people, no incident"`.
   - License: CC0 / Public Domain (Team-created).

---
No proprietary, copyrighted, or unauthorized private media is included in this repository.
