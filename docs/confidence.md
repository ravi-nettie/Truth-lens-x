# Forensic Honesty & Confidence Framework

TruthLens X is built on principles of forensic honesty, epistemological humility, and strict adherence to scientific methodology in digital media examination.

---

## 1. The Fallacy of "Global Fake Probability"

Many commercial verification tools offer an attractive single metric: *"98% Fake"* or *"Authenticity Score: 42%"*. 

TruthLens X categorically rejects this practice as pseudoscientific and forensically misleading:
1. **Base-Rate Fallacy**: Without knowing the prior probability distribution of manipulation in the wild, posterior probabilities calculated on isolated synthetic datasets cannot be generalized.
2. **False Sense of Certainty**: An aggregate score hides the individual indicators, their specific margins of error, and benign alternative causes.
3. **Legal Vulnerability**: Black-box probability scores fail Daubert/Frye legal standards for expert testimony because they lack explainability, clear error rates on real-world distributions, and verifiable provenance.

**TruthLens X Rule**: Never compute, synthesize, or display an aggregate fake percentage.

---

## 2. Standardized Strength Scale

Every technical signal identified by an analyzer is evaluated against a 4-tier strength scale:

| Level | Definition | Forensic Meaning | Example |
| :--- | :--- | :--- | :--- |
| **`informational`** | Technical metadata or neutral structure. | Contextual observation; no anomaly implied. | Standard video scene cut; camera EXIF model tag; missing EXIF (standard on messaging platforms). |
| **`weak`** | Ambiguous statistical deviation. | High false-positive rate; common benign causes. | Slight high-frequency noise variation; single-frame compression block boundary artifact. |
| **`moderate`** | Coherent anomalous pattern. | Warranted suspicion; requires human analyst review. | Spatial copy-move keypoint cluster; audio phase discontinuity at splice point; transcript quantity discrepancy. |
| **`strong`** | High-confidence physical / temporal impossibility. | Severe contradiction between independent physical signals. | Lighting shadow vector direction contradicts solar azimuth derived from verified EXIF timestamp and GPS location. |

---

## 3. Mandatory Alternative Explanations & Limitations

In compliance with Rule 2:
- Every observation with `weak` or `moderate` strength MUST state an explicit `alternative_explanation` in plain English, and describe technical `limitations`.
- Every correlation graph edge with relation `CONTRADICTS` MUST explain benign potential causes (e.g. compression transcoding, colloquial speech approximation, multi-camera switching).
- Reviewers are presented with balanced forensic evidence, ensuring confirmatory bias is mitigated.

---

## 4. Benign-by-Default Metadata

- **Missing EXIF**: Social networks (WhatsApp, X, Facebook, Instagram) routinely strip EXIF metadata to protect user privacy and optimize payload size. Stripped EXIF alone is marked `informational`, never suspicious.
- **Ordinary Scene Cuts**: Standard video editing transitions (hard cuts, dissolves) are marked `informational`.

---

## 5. Uncalibrated Model Transparency

- Machine learning classifiers output raw sigmoid activations or softmax logits trained on narrow datasets (e.g., FaceForensics++, DFDC).
- In TruthLens X, any ML output is:
  1. Required to carry `model_calibrated=False`
  2. Labeled clearly in the UI and reports as `"uncalibrated model output"`
  3. Never displayed as a standalone authenticity verdict.
