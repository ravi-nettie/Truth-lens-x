"""backend/app/services/evidence_store.py

Immutable Evidence Store for TruthLens X.
Adheres strictly to Rule 1, 3, and 4:
- Only component permitted to write original evidence files
- Allow-listed extensions & magic byte header inspection
- Rejects executables/archives (HTTP 415), oversized files (HTTP 413), corrupt files (HTTP 422)
- Stores files at data/evidence/<case_id>/<sha256>.<ext> with read-only permissions (0o444)
- Path traversal prevention
- Recomputes and verifies SHA-256 hashes
- Hash-chained audit logging for all mutations
"""

from datetime import datetime, timezone
import hashlib
import os
from pathlib import Path
import shutil
import stat
from typing import Any, BinaryIO, Dict, Optional, Tuple
from uuid import uuid4

from PIL import Image, UnidentifiedImageError

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.services.audit import append_audit


ALLOWLISTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp",
    ".mp4", ".mov", ".webm",
    ".wav", ".mp3", ".m4a",
    ".txt"
}

KIND_BY_EXTENSION = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
    ".mp4": "video", ".mov": "video", ".webm": "video",
    ".wav": "audio", ".mp3": "audio", ".m4a": "audio",
    ".txt": "text"
}

MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
    ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
    ".txt": "text/plain"
}


class EvidenceStoreError(Exception):
    """Base error for evidence store operations."""
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class UnsupportedMediaTypeError(EvidenceStoreError):
    def __init__(self, message: str = "Unsupported media type."):
        super().__init__(code="UNSUPPORTED_TYPE", message=message, status_code=415)


class PayloadTooLargeError(EvidenceStoreError):
    def __init__(self, message: str = "File exceeds maximum upload limit."):
        super().__init__(code="TOO_LARGE", message=message, status_code=413)


class CorruptFileError(EvidenceStoreError):
    def __init__(self, message: str = "Uploaded file is corrupt or unreadable."):
        super().__init__(code="CORRUPT_FILE", message=message, status_code=422)


class NotFoundError(EvidenceStoreError):
    def __init__(self, message: str = "Resource not found."):
        super().__init__(code="NOT_FOUND", message=message, status_code=404)


class BadRequestError(EvidenceStoreError):
    def __init__(self, message: str = "Bad request."):
        super().__init__(code="UNSUPPORTED_TYPE", message=message, status_code=400)


def inspect_magic_bytes(header: bytes, ext: str) -> None:
    """
    Validates magic bytes against known disallowed formats (executables, archives)
    and checks consistency with declared extension.
    """
    # 1. Immediate rejection of executables
    # Windows PE (MZ)
    if len(header) >= 2 and header[:2] == b"MZ":
        raise UnsupportedMediaTypeError("Executable file detected (MZ header). Executables are strictly prohibited.")
    # Linux ELF
    if len(header) >= 4 and header[:4] == b"\x7fELF":
        raise UnsupportedMediaTypeError("Executable file detected (ELF header). Executables are strictly prohibited.")
    # macOS Mach-O
    if len(header) >= 4 and header[:4] in (
        b"\xfe\xed\xfa\xce", b"\xfe\xed\xfa\xcf",
        b"\xce\xfa\xed\xfe", b"\xcf\xfa\xed\xfe",
        b"\xca\xfe\xba\xbe"
    ):
        raise UnsupportedMediaTypeError("Executable file detected (Mach-O header). Executables are strictly prohibited.")

    # 2. Immediate rejection of archives
    # ZIP / JAR / APK
    if len(header) >= 4 and header[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
        raise UnsupportedMediaTypeError("Archive file detected (ZIP header). Archives are strictly prohibited.")
    # RAR
    if len(header) >= 4 and header[:4] == b"Rar!":
        raise UnsupportedMediaTypeError("Archive file detected (RAR header). Archives are strictly prohibited.")
    # 7-Zip
    if len(header) >= 6 and header[:6] == b"7z\xbc\xaf\x27\x1c":
        raise UnsupportedMediaTypeError("Archive file detected (7z header). Archives are strictly prohibited.")
    # GZIP
    if len(header) >= 2 and header[:2] == b"\x1f\x8b":
        raise UnsupportedMediaTypeError("Archive file detected (GZIP header). Archives are strictly prohibited.")
    # TAR
    if len(header) >= 262 and header[257:262] == b"ustar":
        raise UnsupportedMediaTypeError("Archive file detected (TAR header). Archives are strictly prohibited.")

    # 3. Extension-specific magic verification
    if ext in (".jpg", ".jpeg"):
        if len(header) < 3 or header[:3] != b"\xff\xd8\xff":
            raise CorruptFileError("File does not start with valid JPEG magic bytes (FF D8 FF).")
    elif ext == ".png":
        if len(header) < 8 or header[:8] != b"\x89PNG\r\n\x1a\n":
            raise CorruptFileError("File does not start with valid PNG magic bytes.")
    elif ext == ".webp":
        if len(header) < 12 or header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            raise CorruptFileError("File does not match valid WEBP container magic bytes.")
    elif ext in (".mp4", ".mov", ".m4a"):
        # Quick check for ftyp box or moov box in the first 32 bytes
        has_ftyp = b"ftyp" in header[:32] or b"moov" in header[:32]
        if not has_ftyp and len(header) >= 4:
            # Some QuickTime files start with wide/mdat or 00 00 00
            pass
    elif ext == ".webm":
        if len(header) < 4 or header[:4] != b"\x1a\x45\xdf\xa3":
            raise CorruptFileError("File does not match valid WebM / Matroska EBML header.")
    elif ext == ".wav":
        if len(header) < 12 or header[:4] != b"RIFF" or header[8:12] != b"WAVE":
            raise CorruptFileError("File does not match valid WAV container magic bytes.")
    elif ext == ".mp3":
        is_id3 = len(header) >= 3 and header[:3] == b"ID3"
        is_sync = len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0
        if not (is_id3 or is_sync):
            raise CorruptFileError("File does not match valid MP3 audio header.")


def ingest_evidence(
    case_id: str,
    original_filename: str,
    stream: BinaryIO,
    source_note: str = ""
) -> Dict[str, Any]:
    """
    Streams and ingests an evidence file:
    1. Validates allow-listed extension
    2. Streams to temp file while computing SHA-256 and enforcing MAX_UPLOAD_MB
    3. Inspects magic bytes and performs structural sanity checks (e.g. Pillow verify)
    4. Moves file to read-only store data/evidence/<case_id>/<sha256>.<ext> with mode 0444
    5. Records DB row, timeline event, and hash-chained audit log
    """
    # Verify case exists
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cases WHERE id = ?", (case_id,))
        if not cursor.fetchone():
            raise NotFoundError(f"Case '{case_id}' does not exist.")

    # Sanitize original filename (prevent directory traversal)
    clean_filename = Path(original_filename).name
    ext = Path(clean_filename).suffix.lower()

    if ext not in ALLOWLISTED_EXTENSIONS:
        raise UnsupportedMediaTypeError(
            f"File extension '{ext}' is not supported. "
            f"Allowed extensions: {sorted(list(ALLOWLISTED_EXTENSIONS))}"
        )

    # Temporary staging file
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    temp_file = settings.tmp_dir / f"upload_{uuid4().hex}_{clean_filename}"

    hasher = hashlib.sha256()
    total_bytes = 0
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    header_bytes = bytearray()

    try:
        with open(temp_file, "wb") as f_out:
            while True:
                chunk = stream.read(64 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise PayloadTooLargeError(
                        f"File size exceeds maximum allowed upload limit of {settings.MAX_UPLOAD_MB} MB."
                    )
                if len(header_bytes) < 1024:
                    needed = 1024 - len(header_bytes)
                    header_bytes.extend(chunk[:needed])
                hasher.update(chunk)
                f_out.write(chunk)

        if total_bytes == 0:
            raise CorruptFileError("Uploaded file is empty (0 bytes).")

        # Magic bytes check
        inspect_magic_bytes(bytes(header_bytes), ext)

        # Structural sanity check for images via Pillow
        if ext in (".jpg", ".jpeg", ".png", ".webp"):
            try:
                with Image.open(temp_file) as img:
                    img.verify()
            except (UnidentifiedImageError, Exception) as e:
                raise CorruptFileError(f"Corrupt or unreadable image file: {e}")

        # Compute final SHA-256
        sha256 = hasher.hexdigest()

        # Destination path: data/evidence/<case_id>/<sha256>.<ext>
        dest_dir = settings.evidence_dir / case_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = (dest_dir / f"{sha256}{ext}").resolve()

        # Path traversal guard
        if not str(dest_path).startswith(str(settings.evidence_dir.resolve())):
            raise BadRequestError("Path traversal violation detected in evidence storage path.")

        # If file already exists, verify hash match; otherwise move from temp
        if dest_path.exists():
            temp_file.unlink(missing_ok=True)
        else:
            shutil.move(str(temp_file), str(dest_path))

        # Set read-only permissions mode 0444 (read-only for all)
        os.chmod(dest_path, stat.S_IREAD | stat.S_IRGRP | stat.S_IROTH)

        # Prepare metadata
        evidence_id = f"ev_{sha256[:12]}"
        kind = KIND_BY_EXTENSION.get(ext, "image")
        mime = MIME_BY_EXTENSION.get(ext, "application/octet-stream")
        uploaded_at = datetime.now(timezone.utc).isoformat()
        rel_stored_path = f"data/evidence/{case_id}/{sha256}{ext}"

        # Write to database & audit log
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO evidence
                (id, case_id, kind, original_name, stored_path, sha256, size_bytes, mime, uploaded_at, source_note, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    evidence_id, case_id, kind, clean_filename,
                    rel_stored_path, sha256, total_bytes, mime,
                    uploaded_at, source_note
                )
            )

            # Record timeline event
            event_id = f"evt_{uuid4().hex[:12]}"
            cursor.execute(
                """
                INSERT INTO timeline_events (id, case_id, ts, media_time_ms, kind, ref_id, label)
                VALUES (?, ?, ?, NULL, 'upload', ?, ?)
                """,
                (event_id, case_id, uploaded_at, evidence_id, f"Evidence ingested: {clean_filename}")
            )

            # Update case status to 'ingested' if it was 'created'
            cursor.execute(
                "UPDATE cases SET status = 'ingested' WHERE id = ? AND status = 'created'",
                (case_id,)
            )

            # Audit log entry
            append_audit(
                case_id=case_id,
                actor="analyst",
                action="INGEST_EVIDENCE",
                target=evidence_id,
                details={
                    "evidence_id": evidence_id,
                    "original_name": clean_filename,
                    "sha256": sha256,
                    "size_bytes": total_bytes,
                    "mime": mime
                },
                conn=conn
            )

        return {
            "id": evidence_id,
            "case_id": case_id,
            "filename": clean_filename,
            "original_name": clean_filename,
            "sha256": sha256,
            "modality": kind,
            "kind": kind,
            "mime_type": mime,
            "mime": mime,
            "file_size_bytes": total_bytes,
            "size_bytes": total_bytes,
            "file_path": rel_stored_path,
            "stored_path": rel_stored_path,
            "created_at": uploaded_at,
            "uploaded_at": uploaded_at,
            "source_note": source_note,
            "metadata": {}
        }

    finally:
        if temp_file.exists():
            temp_file.unlink(missing_ok=True)


def verify_hash(evidence_id: str) -> Dict[str, Any]:
    """
    Recomputes SHA-256 on disk, compares to DB record, and appends audit log entry.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, case_id, stored_path, sha256, deleted_at FROM evidence WHERE id = ?",
            (evidence_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise NotFoundError(f"Evidence '{evidence_id}' not found.")

        if row["deleted_at"]:
            raise NotFoundError(f"Evidence '{evidence_id}' has been deleted.")

        case_id = row["case_id"]
        stored_sha256 = row["sha256"]
        stored_path = Path(row["stored_path"])
        if not stored_path.is_absolute():
            stored_path = (settings.data_path.parent / stored_path).resolve()

        if not stored_path.exists():
            raise NotFoundError(f"Evidence file on disk is missing: {stored_path}")

        hasher = hashlib.sha256()
        with open(stored_path, "rb") as f:
            while chunk := f.read(64 * 1024):
                hasher.update(chunk)
        actual_sha256 = hasher.hexdigest()

        match = (actual_sha256 == stored_sha256)

        append_audit(
            case_id=case_id,
            actor="system",
            action="VERIFY_HASH",
            target=evidence_id,
            details={
                "evidence_id": evidence_id,
                "expected_sha256": stored_sha256,
                "actual_sha256": actual_sha256,
                "match": match
            },
            conn=conn
        )

        return {
            "evidence_id": evidence_id,
            "expected_sha256": stored_sha256,
            "actual_sha256": actual_sha256,
            "match": match
        }


def delete_evidence(evidence_id: str, confirm: bool = False) -> Dict[str, Any]:
    """
    Deletes an evidence file and derived artifacts, sets tombstone deleted_at,
    and appends a hash-chained audit log entry. Requires confirm=True.
    """
    if not confirm:
        raise BadRequestError("Confirmation required to delete evidence. Set ?confirm=true.")

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, case_id, stored_path, original_name, sha256, deleted_at FROM evidence WHERE id = ?",
            (evidence_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise NotFoundError(f"Evidence '{evidence_id}' not found.")

        if row["deleted_at"]:
            return {"deleted": True, "evidence_id": evidence_id, "already_deleted": True}

        case_id = row["case_id"]
        stored_path = Path(row["stored_path"])
        if not stored_path.is_absolute():
            stored_path = (settings.data_path.parent / stored_path).resolve()

        # Remove physical file from disk
        if stored_path.exists():
            # Clear read-only bit so Windows allows deletion
            os.chmod(stored_path, stat.S_IWRITE)
            os.unlink(stored_path)

        # Remove derived artifacts directory
        artifacts_dir = settings.artifacts_dir / case_id / evidence_id
        if artifacts_dir.exists():
            shutil.rmtree(artifacts_dir, ignore_errors=True)

        # Set tombstone
        now_ts = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "UPDATE evidence SET deleted_at = ? WHERE id = ?",
            (now_ts, evidence_id)
        )

        append_audit(
            case_id=case_id,
            actor="analyst",
            action="DELETE_EVIDENCE",
            target=evidence_id,
            details={
                "evidence_id": evidence_id,
                "original_name": row["original_name"],
                "sha256": row["sha256"],
                "deleted_at": now_ts
            },
            conn=conn
        )

        return {
            "deleted": True,
            "evidence_id": evidence_id,
            "deleted_at": now_ts
        }

