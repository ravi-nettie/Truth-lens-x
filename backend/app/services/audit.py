"""backend/app/services/audit.py

Hash-chained tamper-evident audit logging for TruthLens X.
Adheres to Rule 2:
- Provenance-aware audit trail
- Cryptographic hash chaining: entry_hash = SHA-256(prev_hash + canonical_json)
- Genesis entry begins with prev_hash = "GENESIS"
"""

import hashlib
import json
from datetime import datetime, timezone
import sqlite3
from typing import Any, Dict, List, Optional

from backend.app.db import get_db


def canonicalize_json(details: Any) -> str:
    """Produces deterministic canonical JSON string without whitespace."""
    return json.dumps(details, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def append_audit(
    case_id: str,
    actor: str,
    action: str,
    target: str,
    details: Dict[str, Any],
    conn: Optional[sqlite3.Connection] = None
) -> str:
    """
    Appends a new hash-chained audit log record.
    Returns the computed entry_hash.
    """
    canonical_json = canonicalize_json(details)
    ts = datetime.now(timezone.utc).isoformat()

    def _execute(db_conn: sqlite3.Connection) -> str:
        cursor = db_conn.cursor()
        cursor.execute(
            "SELECT entry_hash FROM audit_log WHERE case_id = ? ORDER BY id DESC LIMIT 1",
            (case_id,)
        )
        row = cursor.fetchone()
        prev_hash = row["entry_hash"] if row else "GENESIS"

        # Rule-mandated formula: SHA-256(prev_hash + canonical_json)
        hash_payload = (prev_hash + canonical_json).encode("utf-8")
        entry_hash = hashlib.sha256(hash_payload).hexdigest()

        cursor.execute(
            """
            INSERT INTO audit_log (case_id, ts, actor, action, target, details_json, prev_hash, entry_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (case_id, ts, actor, action, target, canonical_json, prev_hash, entry_hash)
        )
        return entry_hash

    if conn is not None:
        return _execute(conn)
    else:
        with get_db() as db_conn:
            return _execute(db_conn)


def verify_audit_chain(
    case_id: str,
    conn: Optional[sqlite3.Connection] = None
) -> Dict[str, Any]:
    """
    Verifies the integrity of the cryptographic audit chain for a case.
    Returns: {"valid": bool, "count": int, "errors": list[str]}
    """
    def _execute(db_conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = db_conn.cursor()
        cursor.execute(
            "SELECT id, ts, actor, action, target, details_json, prev_hash, entry_hash "
            "FROM audit_log WHERE case_id = ? ORDER BY id ASC",
            (case_id,)
        )
        rows = cursor.fetchall()

        if not rows:
            return {"valid": True, "count": 0, "errors": []}

        errors: List[str] = []
        expected_prev = "GENESIS"

        for idx, row in enumerate(rows):
            actual_prev = row["prev_hash"]
            if actual_prev != expected_prev:
                errors.append(
                    f"Entry {row['id']} (index {idx}) prev_hash mismatch: expected '{expected_prev}', got '{actual_prev}'"
                )

            # Recompute entry hash
            try:
                details = json.loads(row["details_json"] or "{}")
                canonical_json = canonicalize_json(details)
            except Exception as e:
                errors.append(f"Entry {row['id']} invalid JSON: {e}")
                canonical_json = row["details_json"] or "{}"

            hash_payload = (actual_prev + canonical_json).encode("utf-8")
            expected_entry_hash = hashlib.sha256(hash_payload).hexdigest()

            if row["entry_hash"] != expected_entry_hash:
                errors.append(
                    f"Entry {row['id']} hash corruption: computed '{expected_entry_hash}', recorded '{row['entry_hash']}'"
                )

            expected_prev = row["entry_hash"]

        return {
            "valid": len(errors) == 0,
            "count": len(rows),
            "errors": errors
        }

    if conn is not None:
        return _execute(conn)
    else:
        with get_db() as db_conn:
            return _execute(db_conn)

