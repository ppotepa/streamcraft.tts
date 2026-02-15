from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass
class ReferenceClip:
    path: Path
    run_id: str
    duration: float
    score: float


def select_reference_clips(
    *,
    corpus_db_path: Path,
    streamer_slug: str,
    target_seconds: float,
    max_per_run: int,
    min_speaker_sim: float = 0.0,
) -> List[ReferenceClip]:
    if not corpus_db_path.exists():
        return []

    conn = sqlite3.connect(str(corpus_db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT clip_path, run_id, duration, score, COALESCE(speaker_sim, 0.0) AS speaker_sim
            FROM clips
            WHERE streamer = ? AND duration > 0
            ORDER BY score DESC, duration DESC
            """,
            (streamer_slug,),
        ).fetchall()
    finally:
        conn.close()

    selected: List[ReferenceClip] = []
    run_counts: Dict[str, int] = {}
    accumulated = 0.0

    for row in rows:
        score = float(row["score"] or 0.0)
        duration = float(row["duration"] or 0.0)
        run_id = str(row["run_id"])
        speaker_sim = float(row["speaker_sim"] or 0.0)

        if speaker_sim < min_speaker_sim:
            continue
        if run_counts.get(run_id, 0) >= max_per_run:
            continue

        clip_path = Path(str(row["clip_path"]))
        if not clip_path.exists():
            continue

        selected.append(ReferenceClip(path=clip_path, run_id=run_id, duration=duration, score=score))
        run_counts[run_id] = run_counts.get(run_id, 0) + 1
        accumulated += duration
        if accumulated >= target_seconds:
            break

    return selected
