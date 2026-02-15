from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable


def _clip_sha1(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS clips (
            clip_hash TEXT PRIMARY KEY,
            streamer TEXT NOT NULL,
            run_id TEXT NOT NULL,
            clip_path TEXT NOT NULL,
            text TEXT,
            duration REAL,
            score REAL,
            snr_db REAL,
            speech_ratio REAL,
            clip_ratio REAL,
            sfx_score REAL,
            speaker_sim REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clips_streamer ON clips(streamer)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_clips_streamer_score ON clips(streamer, score DESC)")


def upsert_run_into_corpus(
    *,
    corpus_db_path: Path,
    streamer_slug: str,
    run_id: str,
    run_dir: Path,
    manifest_jsonl_path: Path,
) -> int:
    if not manifest_jsonl_path.exists():
        return 0

    corpus_db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(corpus_db_path))
    try:
        _ensure_schema(conn)
        before_changes = conn.total_changes

        with manifest_jsonl_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                row: Dict[str, Any] = json.loads(line)
                clip_name = str(row.get("clip") or "")
                if not clip_name:
                    continue
                clip_path = (run_dir / "clips" / clip_name).resolve()
                if not clip_path.exists():
                    continue

                clip_hash = _clip_sha1(clip_path)
                conn.execute(
                    """
                    INSERT OR IGNORE INTO clips (
                        clip_hash, streamer, run_id, clip_path, text, duration, score,
                        snr_db, speech_ratio, clip_ratio, sfx_score, speaker_sim
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        clip_hash,
                        streamer_slug,
                        run_id,
                        clip_path.as_posix(),
                        row.get("text"),
                        float(row.get("duration") or 0.0),
                        float(row.get("score") or 0.0),
                        float(row.get("snrDb") or 0.0),
                        float(row.get("speechRatio") or 0.0),
                        float(row.get("clipRatio") or 0.0),
                        float(row.get("sfxScore") or 0.0),
                        float(row.get("speakerSim") or 0.0),
                    ),
                )
        conn.commit()
        return conn.total_changes - before_changes
    finally:
        conn.close()
