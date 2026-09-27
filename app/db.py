"""SQLite connection helpers."""

from __future__ import annotations

import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_lock = threading.RLock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS actors (
    id INTEGER PRIMARY KEY,
    display_name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    attribution_confidence REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    primary_source TEXT,
    first_seen TEXT,
    last_seen TEXT,
    last_scan TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identifiers (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT,
    confidence REAL,
    first_seen TEXT,
    last_seen TEXT,
    UNIQUE(actor_id, kind, value)
);

CREATE TABLE IF NOT EXISTS persona_links (
    id INTEGER PRIMARY KEY,
    left_actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    right_actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    score REAL NOT NULL,
    evidence TEXT,
    source TEXT,
    observed_at TEXT,
    analyst_confirmed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(left_actor_id, right_actor_id, method)
);

CREATE TABLE IF NOT EXISTS trust_links (
    id INTEGER PRIMARY KEY,
    from_actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    to_actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    marketplace TEXT,
    note TEXT,
    score REAL NOT NULL,
    observed_at TEXT,
    source TEXT,
    UNIQUE(from_actor_id, to_actor_id, marketplace)
);

CREATE TABLE IF NOT EXISTS clearnet_assets (
    id INTEGER PRIMARY KEY,
    asset_ref TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS indicators (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER REFERENCES actors(id) ON DELETE SET NULL,
    service_ref TEXT,
    indicator_type TEXT NOT NULL,
    observation TEXT NOT NULL,
    clearnet_match TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    source TEXT,
    observed_at TEXT,
    last_scan TEXT,
    UNIQUE(actor_id, indicator_type, observation)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    source TEXT,
    reliability REAL,
    UNIQUE(actor_id, occurred_at, event_type, detail)
);

CREATE TABLE IF NOT EXISTS writing_samples (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    body TEXT NOT NULL,
    source TEXT,
    collected_at TEXT,
    UNIQUE(actor_id, label)
);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,
    reliability REAL NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_ingest TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_log (
    id INTEGER PRIMARY KEY,
    feed_name TEXT,
    source_name TEXT,
    reliability REAL,
    status TEXT NOT NULL,
    records INTEGER NOT NULL DEFAULT 0,
    detail TEXT,
    imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ident_value ON identifiers(kind, value);
CREATE INDEX IF NOT EXISTS idx_events_actor_time ON events(actor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_indicators_actor ON indicators(actor_id);
"""

DEFAULT_SETTINGS = {
    "autonomous_enabled": "1",
    "min_reliability": "70",
    "ingest_interval_seconds": "30",
}


def db_path() -> Path:
    return Path(os.environ.get("LATTICE_DB", ROOT / "data" / "lattice.db"))


def feeds_root() -> Path:
    return Path(os.environ.get("LATTICE_FEEDS", ROOT / "data" / "feeds"))


def static_dir() -> Path:
    return ROOT / "app" / "static"


@contextmanager
def connect():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        conn = sqlite3.connect(path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)",
                (key, value),
            )
