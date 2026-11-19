"""backend/app/db.py

SQLite database connection and schema management for TruthLens X.
Enforces Rule 3:
- Single SQLite database running in WAL mode (PRAGMA journal_mode=WAL;)
- Foreign key constraints enabled (PRAGMA foreign_keys=ON;)
- Exact table schemas as specified in Section 11
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Optional

from backend.app.config import settings


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    created_at TEXT NOT NULL,
    notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    source_note TEXT DEFAULT '',
    deleted_at TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL,
    analyzer TEXT NOT NULL,
    tool_version TEXT NOT NULL,
    params_json TEXT,
    status TEXT NOT NULL,
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    run_id TEXT,
    modality TEXT NOT NULL,
    indicator TEXT NOT NULL,
    method TEXT NOT NULL,
    summary TEXT NOT NULL,
    explanation TEXT NOT NULL,
    alternative_explanation TEXT NOT NULL,
    evidence_strength TEXT NOT NULL,
    model_score REAL,
    model_calibrated INTEGER NOT NULL DEFAULT 0,
    model_name TEXT,
    region_json TEXT,
    time_start_ms INTEGER,
    time_end_ms INTEGER,
    artifact_ids_json TEXT,
    details_json TEXT,
    limitations TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    run_id TEXT,
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    source_evidence_id TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    text TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    value_json TEXT NOT NULL,
    time_start_ms INTEGER,
    time_end_ms INTEGER,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (source_evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    src_id TEXT NOT NULL,
    dst_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    rule TEXT NOT NULL,
    evidence_observation_ids_json TEXT NOT NULL,
    explanation TEXT NOT NULL,
    alternative_explanation TEXT NOT NULL,
    strength TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    ts TEXT,
    media_time_ms INTEGER,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    label TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_decisions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    note TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT NOT NULL,
    ts TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details_json TEXT,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
"""


def get_connection(custom_path: Optional[Path] = None) -> sqlite3.Connection:
    """Creates a new SQLite connection configured with WAL mode and foreign keys."""
    db_file = custom_path or settings.db_path
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_file), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def get_db(custom_path: Optional[Path] = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for safe transactional database operations."""
    conn = get_connection(custom_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(custom_path: Optional[Path] = None) -> None:
    """Initializes tables in the SQLite database."""
    with get_db(custom_path) as conn:
        conn.executescript(SCHEMA_SQL)


# Initialize DB automatically upon loading
init_db()

