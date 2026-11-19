"""backend/app/analyzers/image/copymove.py

Forensic Copy-Move forgery detection using ORB features and RANSAC consistency.
Adheres strictly to Rule 2:
- Standalone copy-move findings cap at weak/moderate strength
- Mandatory alternative explanation: repetitive natural textures (brick, foliage, windows)
- Mandatory limitations statement
- Bounding box Region(x, y, w, h) mapped to original coordinate space
- Overlay artifact saved strictly to ctx.artifact_dir
- Pure functional design, no DB access, no unhandled exceptions
"""

import hashlib
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import cv2
import numpy as np
from PIL import Image

from shared.schemas import Modality, Observation, Region, Strength


def detect_copy_move_orb(
    image_np: np.ndarray,
    scale_factor: float = 1.0,
    min_spatial_dist: float = 30.0,
    ratio_thresh: float = 0.75,
    min_inliers: int = 8
) -> Tuple[List[Dict[str, Any]], Optional[np.ndarray], Dict[str, Any]]:
    """
    Detects copy-move duplication using ORB features + self-matching + RANSAC.
    Returns:
    - clusters of matches (with bounding boxes in original coordinates)
    - annotated visualization image (BGR)
    - statistics dict
    """
    if len(image_np.shape) == 3:
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = image_np

    orb = cv2.ORB_create(nfeatures=2500, fastThreshold=12)
    keypoints, descriptors = orb.detectAndCompute(gray, None)

    stats: Dict[str, Any] = {
        "keypoints_detected": len(keypoints) if keypoints else 0,
        "candidate_matches": 0,
        "ransac_inliers": 0,
        "clusters_found": 0,
    }

    if descriptors is None or len(descriptors) < 15:
        return [], None, stats

    # Self-matching with BFMatcher (Hamming distance)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    # Find top 3 neighbors for each descriptor (0: self, 1: best other, 2: second other)
    knn_matches = bf.knnMatch(descriptors, descriptors, k=min(4, len(descriptors)))

    matched_pairs = []
    seen_pairs = set()

    for m_list in knn_matches:
        if len(m_list) < 3:
            continue
        # m_list[0] is self (queryIdx == trainIdx, dist == 0)
        # Find first non-self match that is spatially distant
        query_idx = m_list[0].queryIdx
        pt1 = np.array(keypoints[query_idx].pt)

        candidate = None
        second_candidate = None

        for m in m_list[1:]:
            train_idx = m.trainIdx
            pt2 = np.array(keypoints[train_idx].pt)
            dist = np.linalg.norm(pt1 - pt2)
            if dist >= min_spatial_dist:
                if candidate is None:
                    candidate = m
                elif second_candidate is None:
                    second_candidate = m
                    break

        if candidate and second_candidate:
            # Lowe's ratio test
            if candidate.distance < ratio_thresh * second_candidate.distance:
                pair = tuple(sorted([query_idx, candidate.trainIdx]))
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    matched_pairs.append((query_idx, candidate.trainIdx))

    stats["candidate_matches"] = len(matched_pairs)

    if len(matched_pairs) < min_inliers:
        return [], None, stats

    # Extract source and destination points
    src_pts = np.float32([keypoints[p[0]].pt for p in matched_pairs]).reshape(-1, 1, 2)
    dst_pts = np.float32([keypoints[p[1]].pt for p in matched_pairs]).reshape(-1, 1, 2)

    # Geometric consistency check using affine or homography RANSAC
    # Affine 2D RANSAC is robust for translation / rotation / scale copy-paste
    M, inliers = cv2.estimateAffine2D(src_pts, dst_pts, method=cv2.RANSAC, ransacReprojThreshold=5.0)

    if inliers is None:
        inlier_mask = np.zeros(len(matched_pairs), dtype=bool)
    else:
        inlier_mask = (inliers.ravel() == 1)

    inlier_count = int(np.sum(inlier_mask))
    stats["ransac_inliers"] = inlier_count

    if inlier_count < min_inliers:
        return [], None, stats

    # Valid copy-move cluster confirmed
    inlier_pairs = [matched_pairs[i] for i in range(len(matched_pairs)) if inlier_mask[i]]

    # Compute bounding boxes in original pixel coordinates (scale_factor converts back)
    src_inlier_pts = np.array([keypoints[p[0]].pt for p in inlier_pairs]) * scale_factor
    dst_inlier_pts = np.array([keypoints[p[1]].pt for p in inlier_pairs]) * scale_factor

    def get_bbox(pts: np.ndarray) -> Dict[str, int]:
        x_min, y_min = np.min(pts, axis=0)
        x_max, y_max = np.max(pts, axis=0)
        # Pad by 10 px
        pad = 10
        x = max(0, int(x_min - pad))
        y = max(0, int(y_min - pad))
        w = int(x_max - x_min + 2 * pad)
        h = int(y_max - y_min + 2 * pad)
        return {"x": x, "y": y, "w": w, "h": h}

    src_bbox = get_bbox(src_inlier_pts)
    dst_bbox = get_bbox(dst_inlier_pts)

    clusters = [{
        "inliers_count": inlier_count,
        "src_bbox": src_bbox,
        "dst_bbox": dst_bbox,
    }]
    stats["clusters_found"] = 1

    # Render visualization overlay on working image (RGB)
    vis_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    # Draw matched inlier keypoints and connection lines
    for p in inlier_pairs:
        p1 = tuple(np.round(keypoints[p[0]].pt).astype(int))
        p2 = tuple(np.round(keypoints[p[1]].pt).astype(int))
        cv2.circle(vis_bgr, p1, 4, (0, 0, 255), -1)  # Red for src
        cv2.circle(vis_bgr, p2, 4, (255, 0, 0), -1)  # Blue for dst
        cv2.line(vis_bgr, p1, p2, (0, 255, 255), 1, cv2.LINE_AA)  # Yellow connection

    # Draw bounding boxes (scaled to working image)
    inv_scale = 1.0 / scale_factor
    def draw_box(bbox: Dict[str, int], color: Tuple[int, int, int], label: str):
        x1 = int(bbox["x"] * inv_scale)
        y1 = int(bbox["y"] * inv_scale)
        x2 = int((bbox["x"] + bbox["w"]) * inv_scale)
        y2 = int((bbox["y"] + bbox["h"]) * inv_scale)
        cv2.rectangle(vis_bgr, (x1, y1), (x2, y2), color, 2)
        cv2.putText(vis_bgr, label, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    draw_box(src_bbox, (0, 0, 255), "Cluster A")
    draw_box(dst_bbox, (255, 0, 0), "Cluster B")

    return clusters, vis_bgr, stats


def analyze_copymove(
    evidence_id: str,
    case_id: str,
    image_path: Path,
    artifact_dir: Path,
    working_image: Optional[Image.Image] = None,
    scale_factor: float = 1.0,
    has_editor_metadata: bool = False
) -> Tuple[List[Observation], List[Dict[str, Any]], Dict[str, Any]]:
    """
    Forensic copy-move analysis returning observations, overlay artifacts, and details.
    """
    observations: List[Observation] = []
    artifacts: List[Dict[str, Any]] = []
    details: Dict[str, Any] = {}

    try:
        if working_image is not None:
            img = working_image
        else:
            img = Image.open(image_path)

        rgb_img = img.convert("RGB")
        img_np = np.array(rgb_img)

        clusters, vis_bgr, stats = detect_copy_move_orb(
            img_np,
            scale_factor=scale_factor,
            min_spatial_dist=30.0,
            ratio_thresh=0.75,
            min_inliers=8
        )
        details.update(stats)

        if clusters and vis_bgr is not None:
            # Save overlay artifact
            artifact_id = f"art_copymove_{uuid4().hex[:8]}"
            artifact_filename = f"copymove_{evidence_id}.png"
            artifact_path = artifact_dir / artifact_filename

            vis_rgb = cv2.cvtColor(vis_bgr, cv2.COLOR_BGR2RGB)
            vis_pil = Image.fromarray(vis_rgb)
            vis_pil.save(artifact_path, format="PNG")

            with open(artifact_path, "rb") as f:
                art_sha256 = hashlib.sha256(f.read()).hexdigest()

            artifacts.append({
                "id": artifact_id,
                "case_id": case_id,
                "kind": "image_copymove_overlay",
                "path": str(artifact_path),
                "sha256": art_sha256,
                "description": "Copy-move keypoint cluster overlay with geometric inlier mapping"
            })

            primary_cluster = clusters[0]
            inliers = primary_cluster["inliers_count"]
            src_box = primary_cluster["src_bbox"]

            region = Region(
                x=src_box["x"],
                y=src_box["y"],
                w=src_box["w"],
                h=src_box["h"]
            )

            # Evidence strength rule:
            # Standalone copy-move -> weak.
            # If strong RANSAC inliers (>= 15) AND editor software metadata present -> moderate.
            if inliers >= 15 and has_editor_metadata:
                strength = Strength.moderate
            else:
                strength = Strength.weak

            summary = f"Potential copy-move duplication detected ({inliers} geometric inliers)"
            explanation = (
                f"Feature matching identified a cluster of {inliers} ORB keypoints sharing consistent "
                f"geometric affine transformation across separated spatial regions of the image frame."
            )
            alt_explanation = (
                "Repetitive natural textures, periodic architectural patterns (such as brick walls, window grids, "
                "roof tiles, or parquet floors), identical objects in the same scene, or reflections naturally generate "
                "spatially separated matching keypoints."
            )
            limitations = (
                "Keypoint-based copy-move detection identifies visual self-similarity. Repetitive textures and symmetric "
                "physical scenes can trigger false positives. The overlay artifact must be visually inspected by a human reviewer."
            )

            observations.append(
                Observation(
                    id=f"obs_copymove_{uuid4().hex[:8]}",
                    case_id=case_id,
                    evidence_id=evidence_id,
                    modality=Modality.image,
                    indicator="copy_move_duplication",
                    method="orb_keypoint_ransac_matching",
                    summary=summary,
                    explanation=explanation,
                    alternative_explanation=alt_explanation,
                    evidence_strength=strength,
                    region=region,
                    artifact_ids=[artifact_id],
                    limitations=limitations,
                    details=details
                )
            )

    except Exception as e:
        details["error"] = str(e)

    return observations, artifacts, details

